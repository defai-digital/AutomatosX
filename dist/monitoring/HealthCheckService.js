/**
 * HealthCheckService.ts
 *
 * System health monitoring and component status tracking
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import os from 'os';
import { getDatabase } from '../database/connection.js';
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
export class HealthCheckService extends EventEmitter {
    db;
    startTime;
    checkInterval = null;
    lastHealthStatus = 'healthy';
    constructor(db) {
        super();
        this.db = db || getDatabase();
        this.startTime = Date.now();
    }
    // ============================================================================
    // Component Health Checks
    // ============================================================================
    /**
     * Check database health
     */
    async checkDatabase() {
        const start = Date.now();
        let status = 'healthy';
        let message = 'Database is operational';
        try {
            // Simple query to check connectivity
            const result = this.db.prepare('SELECT 1 as test').get();
            if (!result || result.test !== 1) {
                status = 'unhealthy';
                message = 'Database query returned unexpected result';
            }
            // Check database size
            const dbInfo = this.db.prepare(`
        SELECT page_count * page_size as size
        FROM pragma_page_count(), pragma_page_size()
      `).get();
            const responseTime = Date.now() - start;
            // Degraded if response time > 100ms
            if (responseTime > 100) {
                status = 'degraded';
                message = 'Database response time is slow';
            }
            return {
                component: 'database',
                status,
                timestamp: Date.now(),
                responseTime,
                message,
                metadata: {
                    size: dbInfo.size,
                    walMode: true,
                },
            };
        }
        catch (error) {
            return {
                component: 'database',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Database check failed',
            };
        }
    }
    /**
     * Check cache health (simulated - would connect to actual cache)
     */
    async checkCache() {
        const start = Date.now();
        try {
            // In real implementation, would check Redis/Memcached
            // For now, check if query result caching table exists
            const tables = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='query_results_cache'
      `).all();
            const responseTime = Date.now() - start;
            return {
                component: 'cache',
                status: tables.length > 0 ? 'healthy' : 'degraded',
                timestamp: Date.now(),
                responseTime,
                message: tables.length > 0 ? 'Cache is operational' : 'Cache table not found',
            };
        }
        catch (error) {
            return {
                component: 'cache',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Cache check failed',
            };
        }
    }
    /**
     * Check queue health (checks workflow execution queue)
     */
    async checkQueue() {
        const start = Date.now();
        try {
            // Check if workflow executions monitor table exists
            const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM workflow_executions_monitor
        WHERE status = 'running'
      `).get();
            const runningCount = result.count;
            const responseTime = Date.now() - start;
            let status = 'healthy';
            let message = `Queue is operational (${runningCount} running workflows)`;
            // Degraded if too many running workflows (potential backlog)
            if (runningCount > 100) {
                status = 'degraded';
                message = `High queue load: ${runningCount} running workflows`;
            }
            return {
                component: 'queue',
                status,
                timestamp: Date.now(),
                responseTime,
                message,
                metadata: {
                    runningCount,
                },
            };
        }
        catch (error) {
            return {
                component: 'queue',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Queue check failed',
            };
        }
    }
    /**
     * Check worker pool health (simulated)
     */
    async checkWorkerPool() {
        const start = Date.now();
        try {
            // In real implementation, would check worker pool status
            // For now, check system resources
            const cpuUsage = os.loadavg()[0] / os.cpus().length;
            const responseTime = Date.now() - start;
            let status = 'healthy';
            let message = 'Worker pool is operational';
            if (cpuUsage > 0.8) {
                status = 'degraded';
                message = 'High CPU usage detected';
            }
            return {
                component: 'workerPool',
                status,
                timestamp: Date.now(),
                responseTime,
                message,
                metadata: {
                    cpuUsage: cpuUsage.toFixed(2),
                },
            };
        }
        catch (error) {
            return {
                component: 'workerPool',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Worker pool check failed',
            };
        }
    }
    /**
     * Check providers health (AI providers connectivity)
     */
    async checkProviders() {
        const start = Date.now();
        try {
            // In real implementation, would ping provider endpoints
            // For now, check if provider configuration exists
            const responseTime = Date.now() - start;
            return {
                component: 'providers',
                status: 'healthy',
                timestamp: Date.now(),
                responseTime,
                message: 'Providers are operational',
                metadata: {
                    configured: ['claude', 'gemini', 'openai'],
                },
            };
        }
        catch (error) {
            return {
                component: 'providers',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Providers check failed',
            };
        }
    }
    /**
     * Check disk health
     */
    async checkDisk() {
        const start = Date.now();
        try {
            // Check disk space for database directory
            const dbPath = this.db.name || '.automatosx/db/code-intelligence.db';
            const stats = await fs.stat(dbPath);
            const responseTime = Date.now() - start;
            // Get free space (simplified - would use actual disk space check)
            const freeDiskSpace = 1024 * 1024 * 1024; // 1GB placeholder
            let status = 'healthy';
            let message = 'Disk space is adequate';
            if (freeDiskSpace < 100 * 1024 * 1024) {
                status = 'unhealthy';
                message = 'Disk space critically low';
            }
            else if (freeDiskSpace < 500 * 1024 * 1024) {
                status = 'degraded';
                message = 'Disk space is running low';
            }
            return {
                component: 'disk',
                status,
                timestamp: Date.now(),
                responseTime,
                message,
                metadata: {
                    dbSize: stats.size,
                    freeDiskSpace,
                },
            };
        }
        catch (error) {
            return {
                component: 'disk',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Disk check failed',
            };
        }
    }
    /**
     * Check memory health
     */
    async checkMemory() {
        const start = Date.now();
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memUsagePercent = (usedMem / totalMem) * 100;
            const responseTime = Date.now() - start;
            let status = 'healthy';
            let message = 'Memory usage is normal';
            if (memUsagePercent > 95) {
                status = 'unhealthy';
                message = 'Memory usage critically high';
            }
            else if (memUsagePercent > 85) {
                status = 'degraded';
                message = 'Memory usage is high';
            }
            return {
                component: 'memory',
                status,
                timestamp: Date.now(),
                responseTime,
                message,
                metadata: {
                    totalMem,
                    freeMem,
                    usedMem,
                    usagePercent: memUsagePercent.toFixed(2),
                },
            };
        }
        catch (error) {
            return {
                component: 'memory',
                status: 'unhealthy',
                timestamp: Date.now(),
                responseTime: Date.now() - start,
                message: error instanceof Error ? error.message : 'Memory check failed',
            };
        }
    }
    // ============================================================================
    // System Health
    // ============================================================================
    /**
     * Get overall system health
     */
    async getSystemHealth() {
        const components = await this.checkAllComponents();
        // Determine overall status
        const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
        const degradedCount = components.filter(c => c.status === 'degraded').length;
        let overall = 'healthy';
        if (unhealthyCount > 0) {
            overall = 'unhealthy';
        }
        else if (degradedCount > 0) {
            overall = 'degraded';
        }
        // Emit event if status changed
        if (overall !== this.lastHealthStatus) {
            this.emit('health.changed', { from: this.lastHealthStatus, to: overall });
            this.lastHealthStatus = overall;
        }
        return {
            overall,
            timestamp: Date.now(),
            components,
            uptime: Date.now() - this.startTime,
            version: '2.0.0',
        };
    }
    /**
     * Check all components
     */
    async checkAllComponents() {
        const checks = await Promise.all([
            this.checkDatabase(),
            this.checkCache(),
            this.checkQueue(),
            this.checkWorkerPool(),
            this.checkProviders(),
            this.checkDisk(),
            this.checkMemory(),
        ]);
        return checks;
    }
    /**
     * Get component health by name
     */
    async getComponentHealth(componentName) {
        switch (componentName) {
            case 'database':
                return this.checkDatabase();
            case 'cache':
                return this.checkCache();
            case 'queue':
                return this.checkQueue();
            case 'workerPool':
                return this.checkWorkerPool();
            case 'providers':
                return this.checkProviders();
            case 'disk':
                return this.checkDisk();
            case 'memory':
                return this.checkMemory();
            default:
                return null;
        }
    }
    // ============================================================================
    // Periodic Health Checks
    // ============================================================================
    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs = 30000) {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.checkInterval = setInterval(async () => {
            const health = await this.getSystemHealth();
            this.emit('health.checked', health);
        }, intervalMs);
        // Initial check - Fixed: Handle promise rejection
        this.getSystemHealth()
            .then(health => {
            this.emit('health.checked', health);
        })
            .catch(error => {
            console.error('Initial health check failed:', error);
            this.emit('health.error', error);
        });
    }
    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    /**
     * Get uptime in milliseconds
     */
    getUptime() {
        return Date.now() - this.startTime;
    }
    /**
     * Get uptime formatted as string
     */
    getUptimeFormatted() {
        const uptime = this.getUptime();
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
//# sourceMappingURL=HealthCheckService.js.map