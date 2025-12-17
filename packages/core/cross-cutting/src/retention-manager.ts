/**
 * Retention Manager Implementation
 *
 * Manages data retention policies for automatic cleanup of old data.
 * Supports archiving before deletion and conditional retention.
 *
 * Invariants:
 * - INV-RT-001: Retention policies applied per data type
 * - INV-RT-002: Archive before delete when configured
 * - INV-RT-003: Conditions respected during cleanup
 */

import {
  type RetentionPolicy,
  type RetentionRunResult,
  type RetentionSummary,
  type RetentionDataType,
  type RetentionConditions,
  type ArchiveEntry,
  calculateRetentionCutoff,
  RetentionErrorCodes,
} from '@automatosx/contracts';

/**
 * Retention store interface for data access
 */
export interface RetentionStore {
  /** Find entries older than cutoff date */
  findExpired(
    cutoffDate: string,
    conditions?: RetentionConditions
  ): Promise<RetentionEntry[]>;

  /** Delete entry by ID */
  delete(id: string): Promise<void>;

  /** Get entry size in bytes */
  getSize(id: string): Promise<number>;
}

/**
 * Entry returned by retention store
 */
export interface RetentionEntry {
  id: string;
  createdAt: string;
  status?: string;
  tags?: string[];
  lastAccessedAt?: string;
  [key: string]: unknown;
}

/**
 * Data archiver interface
 */
export interface DataArchiver {
  /** Archive an entry */
  archive(
    dataType: RetentionDataType,
    entry: RetentionEntry,
    format: 'json' | 'csv' | 'parquet',
    path?: string
  ): Promise<ArchiveEntry>;
}

/**
 * Retention manager interface
 */
export interface RetentionManager {
  /** Get all policies */
  getPolicies(): RetentionPolicy[];

  /** Get policy by ID */
  getPolicy(policyId: string): RetentionPolicy | null;

  /** Add policy */
  addPolicy(policy: RetentionPolicy): void;

  /** Remove policy */
  removePolicy(policyId: string): boolean;

  /** Update policy */
  updatePolicy(policyId: string, updates: Partial<RetentionPolicy>): boolean;

  /** Run a specific policy */
  runPolicy(policyId: string): Promise<RetentionRunResult>;

  /** Run all enabled policies */
  runAllPolicies(): Promise<RetentionRunResult[]>;

  /** Get summary of all retention operations */
  getSummary(): RetentionSummary;

  /** Register store for a data type */
  registerStore(dataType: RetentionDataType, store: RetentionStore): void;
}

/**
 * Creates a retention manager
 */
export function createRetentionManager(
  archiver?: DataArchiver
): RetentionManager {
  const policies = new Map<string, RetentionPolicy>();
  const stores = new Map<RetentionDataType, RetentionStore>();
  const lastRuns = new Map<string, RetentionRunResult>();
  let totalStorageReclaimed = 0;
  let totalEntriesDeleted = 0;

  /**
   * Check if entry matches conditions (INV-RT-003)
   */
  function matchesConditions(
    entry: RetentionEntry,
    conditions?: RetentionConditions
  ): boolean {
    if (!conditions) return true;

    // Check status condition
    if (conditions.status && conditions.status.length > 0) {
      if (!entry.status || !conditions.status.includes(entry.status)) {
        return false;
      }
    }

    // Check exclude tags
    if (conditions.excludeTags && conditions.excludeTags.length > 0) {
      if (entry.tags?.some((tag) => conditions.excludeTags?.includes(tag))) {
        return false;
      }
    }

    // Check include tags
    if (conditions.includeTags && conditions.includeTags.length > 0) {
      if (!entry.tags?.some((tag) => conditions.includeTags?.includes(tag))) {
        return false;
      }
    }

    // Check minimum age
    if (conditions.minAgeHours !== undefined && conditions.minAgeHours > 0) {
      const entryAge =
        Date.now() - new Date(entry.createdAt).getTime();
      const minAgeMs = conditions.minAgeHours * 60 * 60 * 1000;
      if (entryAge < minAgeMs) {
        return false;
      }
    }

    // Check last accessed time
    if (
      conditions.keepIfAccessedWithinHours !== undefined &&
      conditions.keepIfAccessedWithinHours > 0 &&
      entry.lastAccessedAt
    ) {
      const lastAccess = new Date(entry.lastAccessedAt).getTime();
      const keepThreshold =
        Date.now() - conditions.keepIfAccessedWithinHours * 60 * 60 * 1000;
      if (lastAccess > keepThreshold) {
        return false;
      }
    }

    return true;
  }

  return {
    getPolicies(): RetentionPolicy[] {
      return Array.from(policies.values());
    },

    getPolicy(policyId: string): RetentionPolicy | null {
      return policies.get(policyId) ?? null;
    },

    addPolicy(policy: RetentionPolicy): void {
      // Validate archive path if archiving enabled (INV-RT-002)
      if (policy.archiveBeforeDelete && !policy.archivePath) {
        throw new RetentionError(
          RetentionErrorCodes.ARCHIVE_PATH_REQUIRED,
          'archivePath required when archiveBeforeDelete is true'
        );
      }
      policies.set(policy.policyId, policy);
    },

    removePolicy(policyId: string): boolean {
      return policies.delete(policyId);
    },

    updatePolicy(
      policyId: string,
      updates: Partial<RetentionPolicy>
    ): boolean {
      const existing = policies.get(policyId);
      if (!existing) return false;

      const updated = { ...existing, ...updates };

      // Validate archive path if archiving enabled
      if (updated.archiveBeforeDelete && !updated.archivePath) {
        throw new RetentionError(
          RetentionErrorCodes.ARCHIVE_PATH_REQUIRED,
          'archivePath required when archiveBeforeDelete is true'
        );
      }

      policies.set(policyId, updated);
      return true;
    },

    // INV-RT-001: Retention policies applied per data type
    async runPolicy(policyId: string): Promise<RetentionRunResult> {
      const policy = policies.get(policyId);
      if (!policy) {
        throw new RetentionError(
          RetentionErrorCodes.POLICY_NOT_FOUND,
          `Policy not found: ${policyId}`
        );
      }

      const store = stores.get(policy.dataType);
      if (!store) {
        throw new RetentionError(
          RetentionErrorCodes.DELETE_FAILED,
          `No store registered for data type: ${policy.dataType}`
        );
      }

      const runId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const errors: string[] = [];

      let entriesProcessed = 0;
      let entriesDeleted = 0;
      let entriesArchived = 0;
      let entriesSkipped = 0;
      let storageReclaimedBytes = 0;

      try {
        // Calculate cutoff date
        const cutoffDate = calculateRetentionCutoff(policy.retentionDays);

        // Find expired entries
        const entries = await store.findExpired(
          cutoffDate.toISOString(),
          policy.conditions
        );

        entriesProcessed = entries.length;

        for (const entry of entries) {
          try {
            // Check conditions (INV-RT-003)
            if (!matchesConditions(entry, policy.conditions)) {
              entriesSkipped++;
              continue;
            }

            // Get entry size for metrics
            let entrySize = 0;
            try {
              entrySize = await store.getSize(entry.id);
            } catch {
              // Size tracking is optional
            }

            // Archive before delete if configured (INV-RT-002)
            if (policy.archiveBeforeDelete && archiver) {
              try {
                await archiver.archive(
                  policy.dataType,
                  entry,
                  policy.archiveFormat,
                  policy.archivePath
                );
                entriesArchived++;
              } catch (archiveError) {
                const msg =
                  archiveError instanceof Error
                    ? archiveError.message
                    : 'Unknown archive error';
                errors.push(`Archive failed for ${entry.id}: ${msg}`);
                // Skip deletion if archive fails
                continue;
              }
            }

            // Delete entry
            await store.delete(entry.id);
            entriesDeleted++;
            storageReclaimedBytes += entrySize;
          } catch (entryError) {
            const msg =
              entryError instanceof Error
                ? entryError.message
                : 'Unknown error';
            errors.push(`Failed to process ${entry.id}: ${msg}`);
          }
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Policy execution failed: ${msg}`);
      }

      const result: RetentionRunResult = {
        runId,
        policyId,
        startedAt,
        completedAt: new Date().toISOString(),
        entriesProcessed,
        entriesDeleted,
        entriesArchived,
        entriesSkipped,
        errors,
        success: errors.length === 0,
        storageReclaimedBytes,
      };

      // Update tracking
      lastRuns.set(policyId, result);
      totalStorageReclaimed += storageReclaimedBytes;
      totalEntriesDeleted += entriesDeleted;

      return result;
    },

    async runAllPolicies(): Promise<RetentionRunResult[]> {
      const results: RetentionRunResult[] = [];

      // Get enabled policies sorted by priority (higher first)
      const enabledPolicies = Array.from(policies.values())
        .filter((p) => p.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const policy of enabledPolicies) {
        try {
          const result = await this.runPolicy(policy.policyId);
          results.push(result);
        } catch (error) {
          // Create error result for failed policy
          const result: RetentionRunResult = {
            runId: crypto.randomUUID(),
            policyId: policy.policyId,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            entriesProcessed: 0,
            entriesDeleted: 0,
            entriesArchived: 0,
            entriesSkipped: 0,
            errors: [
              error instanceof Error ? error.message : 'Unknown error',
            ],
            success: false,
          };
          results.push(result);
          lastRuns.set(policy.policyId, result);
        }
      }

      return results;
    },

    getSummary(): RetentionSummary {
      const allPolicies = Array.from(policies.values());
      const enabledCount = allPolicies.filter((p) => p.enabled).length;

      const lastRunsRecord: Record<string, RetentionRunResult> = {};
      for (const [policyId, result] of lastRuns) {
        lastRunsRecord[policyId] = result;
      }

      return {
        totalPolicies: allPolicies.length,
        enabledPolicies: enabledCount,
        lastRuns: lastRunsRecord,
        totalStorageReclaimedBytes: totalStorageReclaimed,
        totalEntriesDeleted,
      };
    },

    registerStore(dataType: RetentionDataType, store: RetentionStore): void {
      stores.set(dataType, store);
    },
  };
}

/**
 * Creates an in-memory retention store (for testing)
 */
export function createInMemoryRetentionStore(
  entries: Map<string, RetentionEntry>
): RetentionStore {
  return {
    async findExpired(
      cutoffDate: string,
      _conditions?: RetentionConditions
    ): Promise<RetentionEntry[]> {
      const cutoff = new Date(cutoffDate).getTime();
      const result: RetentionEntry[] = [];

      for (const entry of entries.values()) {
        const entryTime = new Date(entry.createdAt).getTime();
        if (entryTime < cutoff) {
          result.push(entry);
        }
      }

      return result;
    },

    async delete(id: string): Promise<void> {
      entries.delete(id);
    },

    async getSize(id: string): Promise<number> {
      const entry = entries.get(id);
      if (!entry) return 0;
      return JSON.stringify(entry).length;
    },
  };
}

/**
 * Creates an in-memory archiver (for testing)
 */
export function createInMemoryArchiver(): DataArchiver & {
  getArchives(): ArchiveEntry[];
} {
  const archives: ArchiveEntry[] = [];

  return {
    async archive(
      dataType: RetentionDataType,
      entry: RetentionEntry,
      format: 'json' | 'csv' | 'parquet',
      path?: string
    ): Promise<ArchiveEntry> {
      const archiveEntry: ArchiveEntry = {
        originalId: entry.id,
        dataType,
        archivedAt: new Date().toISOString(),
        policyId: 'archive',
        archivePath: path ?? `/archives/${dataType}/${entry.id}.${format}`,
        sizeBytes: JSON.stringify(entry).length,
      };
      archives.push(archiveEntry);
      return archiveEntry;
    },

    getArchives(): ArchiveEntry[] {
      return [...archives];
    },
  };
}

/**
 * Retention error
 */
export class RetentionError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `Retention error: ${code}`);
    this.name = 'RetentionError';
  }

  static policyNotFound(policyId: string): RetentionError {
    return new RetentionError(
      RetentionErrorCodes.POLICY_NOT_FOUND,
      `Policy not found: ${policyId}`
    );
  }

  static archiveFailed(entryId: string, error: string): RetentionError {
    return new RetentionError(
      RetentionErrorCodes.ARCHIVE_FAILED,
      `Archive failed for ${entryId}: ${error}`
    );
  }

  static deleteFailed(entryId: string, error: string): RetentionError {
    return new RetentionError(
      RetentionErrorCodes.DELETE_FAILED,
      `Delete failed for ${entryId}: ${error}`
    );
  }
}
