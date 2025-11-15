/**
 * Disaster Recovery System
 * Sprint 6 Day 54: Automated backup and restore for critical data
 */
import { EventEmitter } from 'events';
/**
 * Backup target type
 */
export declare enum BackupTarget {
    CODE_INTELLIGENCE_DB = "code_intelligence_db",
    PLUGIN_METADATA = "plugin_metadata",
    USER_CONFIG = "user_config",
    TELEMETRY_DATA = "telemetry_data",
    FULL_SYSTEM = "full_system"
}
/**
 * Backup status
 */
export declare enum BackupStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed"
}
/**
 * Backup record
 */
export interface BackupRecord {
    id: string;
    target: BackupTarget;
    timestamp: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
    location: string;
    status: BackupStatus;
    integrity?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Restore result
 */
export interface RestoreResult {
    success: boolean;
    target: BackupTarget;
    backupId: string;
    timestamp: number;
    duration: number;
    errors?: string[];
    warnings?: string[];
}
/**
 * Backup options
 */
export interface BackupOptions {
    compress?: boolean;
    encrypt?: boolean;
    offsite?: boolean;
    retention?: number;
}
/**
 * DR metrics
 */
export interface DRMetrics {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    lastBackupTime?: number;
    lastRestoreTime?: number;
    averageBackupDuration: number;
    rto: number;
    rpo: number;
}
/**
 * Disaster Recovery Manager
 */
export declare class DisasterRecovery extends EventEmitter {
    private backups;
    private backupCounter;
    private metrics;
    /**
     * Create backup
     */
    createBackup(target: BackupTarget, sourcePath: string, options?: BackupOptions): Promise<BackupRecord>;
    /**
     * Restore from backup
     */
    restoreBackup(backupId: string, targetPath: string): Promise<RestoreResult>;
    /**
     * Verify backup integrity
     */
    verifyIntegrity(backupId: string): boolean;
    /**
     * Get backup
     */
    getBackup(backupId: string): BackupRecord | undefined;
    /**
     * Get backups by target
     */
    getBackupsByTarget(target: BackupTarget): BackupRecord[];
    /**
     * Get all backups
     */
    getAllBackups(): BackupRecord[];
    /**
     * Get successful backups
     */
    getSuccessfulBackups(): BackupRecord[];
    /**
     * Get latest backup for target
     */
    getLatestBackup(target: BackupTarget): BackupRecord | undefined;
    /**
     * Delete backup
     */
    deleteBackup(backupId: string): boolean;
    /**
     * Prune old backups
     */
    pruneBackups(retentionDays: number): number;
    /**
     * Get DR metrics
     */
    getMetrics(): DRMetrics;
    /**
     * Update RTO/RPO targets
     */
    updateTargets(rto?: number, rpo?: number): void;
    /**
     * Clear all backups
     */
    clearAll(): void;
    /**
     * Generate backup path
     */
    private generateBackupPath;
    /**
     * Simulate backup size
     */
    private simulateBackupSize;
    /**
     * Calculate checksum
     */
    private calculateChecksum;
    /**
     * Update average backup duration
     */
    private updateAverageBackupDuration;
}
/**
 * Create disaster recovery instance
 */
export declare function createDisasterRecovery(): DisasterRecovery;
/**
 * Get global DR instance
 */
export declare function getGlobalDR(): DisasterRecovery;
/**
 * Reset global DR instance
 */
export declare function resetGlobalDR(): void;
//# sourceMappingURL=DisasterRecovery.d.ts.map