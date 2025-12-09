/**
 * Checkpoint Manager (v5.3.0)
 *
 * Manages checkpoint persistence for stage-based execution with resume capability.
 * Handles checkpoint save/load, validation, schema migration, and cleanup.
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import type {
  CheckpointData,
  RunMetadata,
  StageStates
} from '../../types/stage-execution.js';

/**
 * Current checkpoint schema version
 * Increment when making breaking changes to checkpoint format
 */
const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Checkpoint validation error
 */
export class CheckpointValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CheckpointValidationError';
  }
}

/**
 * Checkpoint Manager
 *
 * Responsibilities:
 * - Save/load checkpoints to/from disk
 * - Validate checkpoint integrity (checksum)
 * - Handle schema version migration
 * - Manage checkpoint lifecycle (cleanup)
 * - List available checkpoints
 */
export class CheckpointManager {
  private readonly checkpointDir: string;
  private readonly cleanupAfterDays: number;

  /**
   * Create new CheckpointManager
   *
   * @param checkpointDir - Base directory for checkpoint storage
   * @param cleanupAfterDays - Delete checkpoints older than N days
   */
  constructor(checkpointDir: string, cleanupAfterDays: number = 7) {
    this.checkpointDir = checkpointDir;
    this.cleanupAfterDays = cleanupAfterDays;
  }

  /**
   * Validate runId for security
   *
   * Checks:
   * - Valid UUID format
   * - No path traversal attempts
   *
   * @param runId - Run identifier to validate
   * @throws CheckpointValidationError if validation fails
   */
  private validateRunId(runId: string): void {
    // 1. UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(runId)) {
      throw new CheckpointValidationError(
        `Invalid run ID format: ${runId}. Must be a valid UUID.`,
        'INVALID_RUN_ID'
      );
    }

    // 2. Path traversal check
    const checkpointPath = join(this.checkpointDir, runId);
    const resolved = resolve(checkpointPath);
    const baseResolved = resolve(this.checkpointDir);

    if (!resolved.startsWith(baseResolved)) {
      throw new CheckpointValidationError(
        `Security violation: path traversal detected in run ID: ${runId}`,
        'PATH_TRAVERSAL'
      );
    }
  }

  /**
   * Save checkpoint to disk
   *
   * Creates checkpoint directory structure:
   * .automatosx/checkpoints/<run-id>/
   *   ├── checkpoint.json    (checkpoint data)
   *   ├── metadata.json      (run metadata)
   *   ├── artifacts/         (stage artifacts)
   *   └── logs/              (execution logs)
   *
   * @param checkpoint - Checkpoint data to save
   * @returns Path to saved checkpoint
   */
  async saveCheckpoint(checkpoint: CheckpointData): Promise<string> {
    // ✅ Validate runId before file operations
    this.validateRunId(checkpoint.runId);

    // Ensure checkpoint directory exists
    const runCheckpointDir = join(this.checkpointDir, checkpoint.runId);
    await fs.mkdir(runCheckpointDir, { recursive: true });

    // Calculate checksum
    const checkpointWithChecksum = {
      ...checkpoint,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      checksum: this.calculateChecksum(checkpoint),
      updatedAt: new Date().toISOString(),
    };

    // Save checkpoint data
    const checkpointPath = join(runCheckpointDir, 'checkpoint.json');
    await fs.writeFile(
      checkpointPath,
      JSON.stringify(checkpointWithChecksum, null, 2),
      'utf-8'
    );

    // Save run metadata
    const metadata: RunMetadata = this.extractMetadata(checkpointWithChecksum);
    const metadataPath = join(runCheckpointDir, 'metadata.json');
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Create artifacts and logs directories
    await fs.mkdir(join(runCheckpointDir, 'artifacts'), { recursive: true });
    await fs.mkdir(join(runCheckpointDir, 'logs'), { recursive: true });

    return checkpointPath;
  }

  /**
   * Load checkpoint from disk
   *
   * @param runId - Run identifier
   * @returns Loaded and validated checkpoint
   * @throws CheckpointValidationError if validation fails
   */
  async loadCheckpoint(runId: string): Promise<CheckpointData> {
    // ✅ Validate runId before file operations
    this.validateRunId(runId);

    const checkpointPath = join(this.checkpointDir, runId, 'checkpoint.json');

    // Check if checkpoint exists
    try {
      await fs.access(checkpointPath);
    } catch {
      throw new CheckpointValidationError(
        `Checkpoint not found: ${runId}`,
        'CHECKPOINT_NOT_FOUND'
      );
    }

    // Load checkpoint data
    const checkpointJson = await fs.readFile(checkpointPath, 'utf-8');

    let checkpoint: CheckpointData;
    try {
      checkpoint = JSON.parse(checkpointJson) as CheckpointData;
    } catch (error) {
      throw new CheckpointValidationError(
        `Checkpoint file contains invalid JSON: ${runId} - ${(error as Error).message}`,
        'INVALID_CHECKPOINT_FORMAT'
      );
    }

    // Validate checkpoint
    await this.validateCheckpoint(checkpoint);

    // Migrate if needed
    const migratedCheckpoint = await this.migrateCheckpoint(checkpoint);

    return migratedCheckpoint;
  }

  /**
   * Validate checkpoint integrity
   *
   * Checks:
   * - Checksum matches data
   * - Schema version is compatible
   * - Required fields are present
   *
   * @param checkpoint - Checkpoint to validate
   * @throws CheckpointValidationError if validation fails
   */
  async validateCheckpoint(checkpoint: CheckpointData): Promise<void> {
    // Validate required fields
    if (!checkpoint.runId) {
      throw new CheckpointValidationError(
        'Missing required field: runId',
        'INVALID_CHECKPOINT'
      );
    }
    if (!checkpoint.agent) {
      throw new CheckpointValidationError(
        'Missing required field: agent',
        'INVALID_CHECKPOINT'
      );
    }
    if (!checkpoint.task) {
      throw new CheckpointValidationError(
        'Missing required field: task',
        'INVALID_CHECKPOINT'
      );
    }

    // Validate schema version
    if (!checkpoint.schemaVersion) {
      throw new CheckpointValidationError(
        'Missing schema version',
        'INVALID_SCHEMA'
      );
    }

    // Check if schema version is compatible
    const checkpointVersion = this.parseVersion(checkpoint.schemaVersion);
    const currentVersion = this.parseVersion(CURRENT_SCHEMA_VERSION);

    if (checkpointVersion.major > currentVersion.major) {
      throw new CheckpointValidationError(
        `Incompatible schema version: ${checkpoint.schemaVersion} (current: ${CURRENT_SCHEMA_VERSION})`,
        'INCOMPATIBLE_SCHEMA'
      );
    }

    // Validate checksum
    if (!checkpoint.checksum) {
      throw new CheckpointValidationError(
        'Missing checksum',
        'INVALID_CHECKPOINT'
      );
    }

    const expectedChecksum = this.calculateChecksum(checkpoint);
    if (checkpoint.checksum !== expectedChecksum) {
      throw new CheckpointValidationError(
        'Checksum mismatch - checkpoint may be corrupted',
        'CHECKSUM_MISMATCH'
      );
    }
  }

  /**
   * Migrate checkpoint to current schema version
   *
   * @param checkpoint - Checkpoint to migrate
   * @returns Migrated checkpoint
   */
  async migrateCheckpoint(checkpoint: CheckpointData): Promise<CheckpointData> {
    const checkpointVersion = this.parseVersion(checkpoint.schemaVersion);
    const currentVersion = this.parseVersion(CURRENT_SCHEMA_VERSION);

    // No migration needed
    if (checkpoint.schemaVersion === CURRENT_SCHEMA_VERSION) {
      return checkpoint;
    }

    let migrated = { ...checkpoint };

    // Apply migrations based on version
    // v1.0.0 → v1.1.0 (future migration example)
    if (checkpointVersion.major === 1 && checkpointVersion.minor === 0) {
      // Example: Add new fields, transform data, etc.
      // migrated = this.migrateV1_0_to_V1_1(migrated);
    }

    // Update schema version
    migrated.schemaVersion = CURRENT_SCHEMA_VERSION;
    migrated.checksum = this.calculateChecksum(migrated);

    // Save migrated checkpoint
    await this.saveCheckpoint(migrated);

    return migrated;
  }

  /**
   * Delete checkpoint from disk
   *
   * @param runId - Run identifier
   */
  async deleteCheckpoint(runId: string): Promise<void> {
    // ✅ Validate runId before file operations
    this.validateRunId(runId);

    const runCheckpointDir = join(this.checkpointDir, runId);

    try {
      await fs.rm(runCheckpointDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if checkpoint doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all available checkpoints
   *
   * @returns Array of run metadata for all checkpoints
   */
  async listCheckpoints(): Promise<RunMetadata[]> {
    // Ensure checkpoint directory exists
    try {
      await fs.access(this.checkpointDir);
    } catch {
      // No checkpoints exist yet
      return [];
    }

    // Read all checkpoint directories
    const entries = await fs.readdir(this.checkpointDir, { withFileTypes: true });
    const runDirs = entries.filter((entry) => entry.isDirectory());

    // Load metadata for each checkpoint
    const metadataList: RunMetadata[] = [];

    for (const runDir of runDirs) {
      try {
        const metadataPath = join(this.checkpointDir, runDir.name, 'metadata.json');
        const metadataJson = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataJson) as RunMetadata;
        metadataList.push(metadata);
      } catch {
        // Skip invalid checkpoints
        continue;
      }
    }

    // Sort by updatedAt (most recent first)
    metadataList.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return metadataList;
  }

  /**
   * Cleanup old checkpoints
   *
   * Deletes checkpoints older than cleanupAfterDays.
   *
   * @returns Number of checkpoints deleted
   */
  async cleanupOldCheckpoints(): Promise<number> {
    const checkpoints = await this.listCheckpoints();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.cleanupAfterDays);

    let deletedCount = 0;

    for (const checkpoint of checkpoints) {
      const checkpointDate = new Date(checkpoint.updatedAt);
      if (checkpointDate < cutoffDate) {
        await this.deleteCheckpoint(checkpoint.runId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get checkpoint directory path for a run
   *
   * @param runId - Run identifier
   * @returns Path to checkpoint directory
   */
  getCheckpointDir(runId: string): string {
    // ✅ Validate runId before returning path
    this.validateRunId(runId);

    return join(this.checkpointDir, runId);
  }

  /**
   * Check if checkpoint exists for a run
   *
   * @param runId - Run identifier
   * @returns True if checkpoint exists
   */
  async checkpointExists(runId: string): Promise<boolean> {
    // ✅ Validate runId before file operations
    this.validateRunId(runId);

    const checkpointPath = join(this.checkpointDir, runId, 'checkpoint.json');
    try {
      await fs.access(checkpointPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate SHA-256 checksum for checkpoint data
   *
   * @param checkpoint - Checkpoint data
   * @returns Hex-encoded checksum
   */
  private calculateChecksum(checkpoint: CheckpointData): string {
    // Create a copy without checksum field for calculation
    const { checksum, updatedAt, ...dataForChecksum } = checkpoint;

    // Calculate SHA-256 hash
    const hash = createHash('sha256');
    hash.update(JSON.stringify(dataForChecksum));
    return hash.digest('hex');
  }

  /**
   * Extract run metadata from checkpoint
   *
   * @param checkpoint - Checkpoint data
   * @returns Run metadata
   */
  private extractMetadata(checkpoint: CheckpointData): RunMetadata {
    const completedStages = checkpoint.stages.filter(
      (s) => s.status === 'completed'
    ).length;

    return {
      runId: checkpoint.runId,
      agent: checkpoint.agent,
      task: checkpoint.task,
      mode: checkpoint.mode,
      totalStages: checkpoint.stages.length,
      completedStages,
      status: this.determineRunStatus(checkpoint.stages),
      startedAt: checkpoint.createdAt,
      updatedAt: checkpoint.updatedAt,
      resumable: true,
    };
  }

  /**
   * Determine overall run status from stage states
   *
   * @param stages - Stage states
   * @returns Run status
   */
  private determineRunStatus(
    stages: StageStates[]
  ): RunMetadata['status'] {
    const hasRunning = stages.some((s) => s.status === 'running');
    const hasError = stages.some((s) => s.status === 'error');
    const hasCheckpoint = stages.some((s) => s.status === 'checkpoint');
    const allCompleted = stages.every((s) => s.status === 'completed' || s.status === 'skipped');

    if (hasRunning) return 'running';
    if (hasError) return 'failed';
    if (hasCheckpoint) return 'paused';
    if (allCompleted) return 'completed';
    return 'paused';
  }

  /**
   * Parse semantic version string
   *
   * @param version - Version string (e.g., "1.0.0")
   * @returns Parsed version components
   */
  private parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
  } {
    const parts = version.split('.').map((p) => {
      const num = parseInt(p, 10);
      return isNaN(num) ? 0 : num;
    });
    return {
      major: parts[0] ?? 0,
      minor: parts[1] ?? 0,
      patch: parts[2] ?? 0,
    };
  }
}
