/**
 * MCP Config Backup Management (v12.0.0)
 *
 * Manages backup and restore operations for MCP config files.
 * Provides cleanup utilities for old backups.
 *
 * @module mcp/config-backup
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../shared/logging/logger.js';
import { getProviderConfigPath, type MCPProvider } from './config-injector.js';

/**
 * Backup metadata
 */
export interface BackupInfo {
  path: string;
  timestamp: Date;
  provider: MCPProvider;
  size: number;
}

/**
 * List all backups for a provider
 */
export async function listBackups(provider: MCPProvider): Promise<BackupInfo[]> {
  const configPath = getProviderConfigPath(provider);
  const dir = path.dirname(configPath);
  const baseName = path.basename(configPath);

  try {
    const files = await fs.readdir(dir);
    const backupPattern = new RegExp(`^${baseName.replace('.', '\\.')}\\.backup-(.+)$`);

    const backups: BackupInfo[] = [];

    for (const file of files) {
      const match = file.match(backupPattern);
      if (match && match[1]) {
        const backupPath = path.join(dir, file);
        try {
          const stats = await fs.stat(backupPath);
          // Convert timestamp format back: 2025-12-07T01-23-45-678Z -> 2025-12-07T01:23:45.678Z
          // The backup filename uses hyphens for colons/periods to be filesystem-safe
          const timestampStr = match[1]
            .replace(/^(\d{4}-\d{2}-\d{2})T/, '$1T')  // Keep date part
            .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');  // Fix time part

          backups.push({
            path: backupPath,
            timestamp: new Date(timestampStr),
            provider,
            size: stats.size
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }

    // Sort by timestamp, newest first
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return backups;
  } catch {
    return [];
  }
}

/**
 * Restore from a specific backup
 */
export async function restoreFromBackup(backupPath: string): Promise<boolean> {
  try {
    // Validate backup exists
    await fs.access(backupPath, fs.constants.R_OK);

    // Determine config path from backup path
    const configPath = backupPath.replace(/\.backup-.*$/, '');

    // Create a backup of current state before restoring
    const currentBackupPath = `${configPath}.backup-pre-restore-${Date.now()}`;
    try {
      await fs.copyFile(configPath, currentBackupPath);
      logger.debug('Created pre-restore backup', { path: currentBackupPath });
    } catch {
      // Current config might not exist, that's OK
    }

    // Restore from backup
    await fs.copyFile(backupPath, configPath);

    logger.info('Restored config from backup', { backupPath, configPath });
    return true;
  } catch (error) {
    logger.error('Failed to restore from backup', {
      backupPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Delete a specific backup
 */
export async function deleteBackup(backupPath: string): Promise<boolean> {
  try {
    await fs.unlink(backupPath);
    logger.debug('Deleted backup', { path: backupPath });
    return true;
  } catch (error) {
    logger.error('Failed to delete backup', {
      backupPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Clean up old backups, keeping only the most recent N backups
 */
export async function cleanupOldBackups(
  provider: MCPProvider,
  keepCount: number = 5
): Promise<number> {
  const backups = await listBackups(provider);

  if (backups.length <= keepCount) {
    return 0;
  }

  const toDelete = backups.slice(keepCount);
  let deletedCount = 0;

  for (const backup of toDelete) {
    if (await deleteBackup(backup.path)) {
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    logger.info('Cleaned up old backups', {
      provider,
      deleted: deletedCount,
      kept: keepCount
    });
  }

  return deletedCount;
}

/**
 * Get the most recent backup for a provider
 */
export async function getLatestBackup(provider: MCPProvider): Promise<BackupInfo | null> {
  const backups = await listBackups(provider);
  return backups.length > 0 ? backups[0]! : null;
}

/**
 * Restore from the most recent backup
 */
export async function restoreLatestBackup(provider: MCPProvider): Promise<boolean> {
  const latest = await getLatestBackup(provider);

  if (!latest) {
    logger.warn('No backups found to restore', { provider });
    return false;
  }

  return restoreFromBackup(latest.path);
}
