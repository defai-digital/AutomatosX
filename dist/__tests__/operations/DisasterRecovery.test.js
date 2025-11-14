/**
 * Disaster Recovery Tests
 * Sprint 6 Day 54: DR system tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DisasterRecovery, createDisasterRecovery, getGlobalDR, resetGlobalDR, BackupTarget, BackupStatus, } from '../../operations/DisasterRecovery.js';
describe('DisasterRecovery', () => {
    let dr;
    beforeEach(() => {
        dr = createDisasterRecovery();
    });
    describe('Backup Creation', () => {
        it('should create backup with compression', async () => {
            const listener = vi.fn();
            dr.on('backup-started', listener);
            const backup = await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code.db', {
                compress: true,
            });
            expect(backup).toMatchObject({
                id: expect.stringContaining('backup-'),
                target: BackupTarget.CODE_INTELLIGENCE_DB,
                compressed: true,
                encrypted: false,
                status: BackupStatus.COMPLETED,
                integrity: expect.stringContaining('sha256-'),
            });
            expect(listener).toHaveBeenCalled();
        });
        it('should create backup with encryption', async () => {
            const backup = await dr.createBackup(BackupTarget.PLUGIN_METADATA, '/data/plugins.json', {
                encrypt: true,
            });
            expect(backup.encrypted).toBe(true);
            expect(backup.status).toBe(BackupStatus.COMPLETED);
        });
        it('should emit backup-completed event', async () => {
            const listener = vi.fn();
            dr.on('backup-completed', listener);
            await dr.createBackup(BackupTarget.USER_CONFIG, '/config/user.json');
            expect(listener).toHaveBeenCalledWith({
                backupId: expect.stringContaining('backup-'),
                target: BackupTarget.USER_CONFIG,
                size: expect.any(Number),
                duration: expect.any(Number),
                location: expect.stringContaining('backups/'),
            });
        });
        it('should track backup metrics', async () => {
            await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code.db');
            await dr.createBackup(BackupTarget.PLUGIN_METADATA, '/data/plugins.json');
            const metrics = dr.getMetrics();
            expect(metrics.totalBackups).toBe(2);
            expect(metrics.successfulBackups).toBe(2);
            expect(metrics.lastBackupTime).toBeGreaterThan(0);
            expect(metrics.averageBackupDuration).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Backup Restore', () => {
        it('should restore from backup successfully', async () => {
            const listener = vi.fn();
            dr.on('restore-started', listener);
            const backup = await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code.db');
            const result = await dr.restoreBackup(backup.id, '/db/restored.db');
            expect(result.success).toBe(true);
            expect(result.backupId).toBe(backup.id);
            expect(result.target).toBe(BackupTarget.CODE_INTELLIGENCE_DB);
            expect(listener).toHaveBeenCalled();
        });
        it('should fail restore for non-existent backup', async () => {
            const result = await dr.restoreBackup('non-existent', '/db/restored.db');
            expect(result.success).toBe(false);
            expect(result.errors).toContain('Backup not found');
        });
        it('should emit restore-completed event', async () => {
            const listener = vi.fn();
            dr.on('restore-completed', listener);
            const backup = await dr.createBackup(BackupTarget.PLUGIN_METADATA, '/data/plugins.json');
            await dr.restoreBackup(backup.id, '/data/restored.json');
            expect(listener).toHaveBeenCalledWith({
                backupId: backup.id,
                target: BackupTarget.PLUGIN_METADATA,
                duration: expect.any(Number),
            });
        });
        it('should track last restore time in metrics', async () => {
            const backup = await dr.createBackup(BackupTarget.USER_CONFIG, '/config/user.json');
            await dr.restoreBackup(backup.id, '/config/restored.json');
            const metrics = dr.getMetrics();
            expect(metrics.lastRestoreTime).toBeGreaterThan(0);
        });
    });
    describe('Backup Integrity', () => {
        it('should verify backup integrity', async () => {
            const backup = await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code.db');
            const valid = dr.verifyIntegrity(backup.id);
            expect(valid).toBe(true);
        });
        it('should fail integrity check for non-existent backup', () => {
            const valid = dr.verifyIntegrity('non-existent');
            expect(valid).toBe(false);
        });
    });
    describe('Backup Queries', () => {
        beforeEach(async () => {
            await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code1.db');
            await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code2.db');
            await dr.createBackup(BackupTarget.PLUGIN_METADATA, '/data/plugins.json');
        });
        it('should get backup by ID', async () => {
            const backups = dr.getAllBackups();
            const backup = dr.getBackup(backups[0].id);
            expect(backup).toBeDefined();
            expect(backup?.id).toBe(backups[0].id);
        });
        it('should get backups by target', () => {
            const codeBackups = dr.getBackupsByTarget(BackupTarget.CODE_INTELLIGENCE_DB);
            expect(codeBackups).toHaveLength(2);
            expect(codeBackups.every((b) => b.target === BackupTarget.CODE_INTELLIGENCE_DB)).toBe(true);
        });
        it('should get all backups', () => {
            const allBackups = dr.getAllBackups();
            expect(allBackups).toHaveLength(3);
        });
        it('should get successful backups', () => {
            const successful = dr.getSuccessfulBackups();
            expect(successful).toHaveLength(3);
            expect(successful.every((b) => b.status === BackupStatus.COMPLETED)).toBe(true);
        });
        it('should get latest backup for target', () => {
            const latest = dr.getLatestBackup(BackupTarget.CODE_INTELLIGENCE_DB);
            expect(latest).toBeDefined();
            expect(latest?.target).toBe(BackupTarget.CODE_INTELLIGENCE_DB);
            // Should be the most recent
            const allCodeBackups = dr.getBackupsByTarget(BackupTarget.CODE_INTELLIGENCE_DB);
            const maxTimestamp = Math.max(...allCodeBackups.map((b) => b.timestamp));
            expect(latest?.timestamp).toBe(maxTimestamp);
        });
    });
    describe('Backup Management', () => {
        it('should delete backup', async () => {
            const listener = vi.fn();
            dr.on('backup-deleted', listener);
            const backup = await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code.db');
            const deleted = dr.deleteBackup(backup.id);
            expect(deleted).toBe(true);
            expect(dr.getBackup(backup.id)).toBeUndefined();
            expect(listener).toHaveBeenCalled();
        });
        it('should return false when deleting non-existent backup', () => {
            const deleted = dr.deleteBackup('non-existent');
            expect(deleted).toBe(false);
        });
        it('should prune old backups', async () => {
            const listener = vi.fn();
            dr.on('backups-pruned', listener);
            // Create backups
            const backup1 = await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code1.db');
            const backup2 = await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code2.db');
            // Manually set old timestamps to simulate old backups
            const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
            backup1.timestamp = oldTimestamp;
            backup2.timestamp = oldTimestamp;
            // Prune backups older than 7 days
            const pruned = dr.pruneBackups(7);
            expect(pruned).toBe(2);
            expect(listener).toHaveBeenCalledWith({
                count: 2,
                retentionDays: 7,
            });
        });
    });
    describe('DR Metrics', () => {
        it('should get DR metrics', () => {
            const metrics = dr.getMetrics();
            expect(metrics).toMatchObject({
                totalBackups: expect.any(Number),
                successfulBackups: expect.any(Number),
                failedBackups: expect.any(Number),
                averageBackupDuration: expect.any(Number),
                rto: expect.any(Number),
                rpo: expect.any(Number),
            });
        });
        it('should update RTO/RPO targets', () => {
            const listener = vi.fn();
            dr.on('targets-updated', listener);
            dr.updateTargets(7200000, 1800000); // 2 hours RTO, 30 minutes RPO
            const metrics = dr.getMetrics();
            expect(metrics.rto).toBe(7200000);
            expect(metrics.rpo).toBe(1800000);
            expect(listener).toHaveBeenCalledWith({ rto: 7200000, rpo: 1800000 });
        });
    });
    describe('Full System Backup', () => {
        it('should create full system backup', async () => {
            const backup = await dr.createBackup(BackupTarget.FULL_SYSTEM, '/system', {
                compress: true,
                encrypt: true,
            });
            expect(backup.target).toBe(BackupTarget.FULL_SYSTEM);
            expect(backup.compressed).toBe(true);
            expect(backup.encrypted).toBe(true);
            expect(backup.status).toBe(BackupStatus.COMPLETED);
        });
    });
    describe('Clear Operations', () => {
        beforeEach(async () => {
            await dr.createBackup(BackupTarget.CODE_INTELLIGENCE_DB, '/db/code.db');
        });
        it('should clear all backups', () => {
            const listener = vi.fn();
            dr.on('all-cleared', listener);
            dr.clearAll();
            const allBackups = dr.getAllBackups();
            expect(allBackups).toHaveLength(0);
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Global DR', () => {
        beforeEach(() => {
            resetGlobalDR();
        });
        it('should get global DR instance', () => {
            const global = getGlobalDR();
            expect(global).toBeInstanceOf(DisasterRecovery);
        });
        it('should return same instance', () => {
            const dr1 = getGlobalDR();
            const dr2 = getGlobalDR();
            expect(dr1).toBe(dr2);
        });
        it('should reset global DR instance', () => {
            const dr1 = getGlobalDR();
            resetGlobalDR();
            const dr2 = getGlobalDR();
            expect(dr2).not.toBe(dr1);
        });
    });
});
//# sourceMappingURL=DisasterRecovery.test.js.map