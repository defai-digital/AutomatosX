/**
 * Permission Enforcer
 * Sprint 4 Day 32: Runtime permission enforcement and validation
 */
import type { PluginPermissions } from './types/PluginManifest.js';
import { EventEmitter } from 'events';
/**
 * Permission check result
 */
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    auditLog?: AuditLogEntry;
}
/**
 * Audit log entry
 */
export interface AuditLogEntry {
    timestamp: string;
    pluginName: string;
    action: string;
    resource: string;
    allowed: boolean;
    reason?: string;
}
/**
 * Permission context
 */
export interface PermissionContext {
    pluginName: string;
    permissions: PluginPermissions;
}
/**
 * Permission Enforcer Events
 */
export interface PermissionEnforcerEvents {
    'permission-check': (entry: AuditLogEntry) => void;
    'permission-denied': (entry: AuditLogEntry) => void;
    'permission-granted': (entry: AuditLogEntry) => void;
}
/**
 * Permission Enforcer
 */
export declare class PermissionEnforcer extends EventEmitter {
    private contexts;
    private auditLog;
    /**
     * Register plugin permissions
     */
    register(pluginName: string, permissions: PluginPermissions): void;
    /**
     * Unregister plugin
     */
    unregister(pluginName: string): void;
    /**
     * Check filesystem read permission
     */
    checkFilesystemRead(pluginName: string, path: string): PermissionCheckResult;
    /**
     * Check filesystem write permission
     */
    checkFilesystemWrite(pluginName: string, path: string): PermissionCheckResult;
    /**
     * Check network access permission
     */
    checkNetworkAccess(pluginName: string, domain: string): PermissionCheckResult;
    /**
     * Check memory allocation permission
     */
    checkMemoryAllocation(pluginName: string, requestedMB: number): PermissionCheckResult;
    /**
     * Check process spawn permission
     */
    checkProcessSpawn(pluginName: string, command: string): PermissionCheckResult;
    /**
     * Check environment access permission
     */
    checkEnvAccess(pluginName: string, envVar: string): PermissionCheckResult;
    /**
     * Get plugin permissions
     */
    getPermissions(pluginName: string): PluginPermissions | null;
    /**
     * Get audit log
     */
    getAuditLog(): AuditLogEntry[];
    /**
     * Get audit log for specific plugin
     */
    getPluginAuditLog(pluginName: string): AuditLogEntry[];
    /**
     * Clear audit log
     */
    clearAuditLog(): void;
    /**
     * Get permission summary
     */
    getPermissionSummary(pluginName: string): {
        filesystem: {
            read: string[];
            write: string[];
        };
        network: {
            allowedDomains: string[];
        };
        memory: {
            maxMB: number | null;
        };
        runtime: {
            canSpawnProcess: boolean;
            canAccessEnv: boolean;
        };
    };
    /**
     * Allow permission and log
     */
    private allow;
    /**
     * Deny permission and log
     */
    private deny;
}
/**
 * Create permission enforcer
 */
export declare function createPermissionEnforcer(): PermissionEnforcer;
/**
 * Get global permission enforcer
 */
export declare function getPermissionEnforcer(): PermissionEnforcer;
/**
 * Reset global permission enforcer (for testing)
 */
export declare function resetPermissionEnforcer(): void;
//# sourceMappingURL=PermissionEnforcer.d.ts.map