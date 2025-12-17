/**
 * Storage Port Interfaces for Agent Domain
 *
 * These interfaces define the contracts for storage implementations.
 * Application layers should depend on these interfaces, not on concrete implementations.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 */

import type { Checkpoint, ResumeContext, MemorySnapshotItem, CheckpointConfig } from './schema.js';

// ============================================================================
// Checkpoint Storage Port
// ============================================================================

/**
 * Checkpoint Storage Port Interface
 *
 * Allows different storage backends for checkpoint persistence.
 *
 * INV-CP-STORE-001: save() must be atomic - checkpoint is fully saved or not at all
 * INV-CP-STORE-002: load() returns null for non-existent checkpoints (not throw)
 * INV-CP-STORE-003: loadLatest() returns checkpoints in creation order (newest first)
 * INV-CP-STORE-004: deleteExpired() is idempotent - safe to call multiple times
 */
export interface CheckpointStoragePort {
  /**
   * Save a checkpoint
   * INV-CP-STORE-001: Must be atomic
   */
  save(checkpoint: Checkpoint): Promise<void>;

  /**
   * Load a checkpoint by ID
   * INV-CP-STORE-002: Returns null if not found
   */
  load(checkpointId: string): Promise<Checkpoint | null>;

  /**
   * Load latest checkpoint for an agent
   * INV-CP-STORE-003: Returns newest checkpoint first
   */
  loadLatest(agentId: string, sessionId?: string): Promise<Checkpoint | null>;

  /**
   * List checkpoints for an agent
   */
  list(agentId: string, sessionId?: string): Promise<Checkpoint[]>;

  /**
   * Delete a checkpoint
   * @returns true if checkpoint existed and was deleted
   */
  delete(checkpointId: string): Promise<boolean>;

  /**
   * Delete expired checkpoints
   * INV-CP-STORE-004: Idempotent
   * @returns number of checkpoints deleted
   */
  deleteExpired(): Promise<number>;
}

/**
 * Checkpoint Manager Port Interface
 *
 * Manages checkpoints for a single agent execution.
 *
 * INV-CP-MGR-001: createCheckpoint includes all data needed to resume
 * INV-CP-MGR-002: shouldCheckpoint is deterministic based on config and step index
 */
export interface CheckpointManagerPort {
  /**
   * Get checkpoint configuration
   */
  getConfig(): CheckpointConfig;

  /**
   * Create a checkpoint from current execution state
   * INV-CP-MGR-001: Must capture all resumption data
   */
  createCheckpoint(
    stepIndex: number,
    completedStepId: string,
    stepOutputs: Record<string, unknown>,
    context: Record<string, unknown>,
    memorySnapshot?: MemorySnapshotItem[]
  ): Promise<Checkpoint>;

  /**
   * Get resume context from a checkpoint
   */
  getResumeContext(checkpointId: string): Promise<ResumeContext | null>;

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): Promise<Checkpoint | null>;

  /**
   * List all checkpoints
   */
  listCheckpoints(): Promise<Checkpoint[]>;

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(checkpointId: string): Promise<boolean>;

  /**
   * Clean up expired checkpoints
   */
  cleanupExpired(): Promise<number>;

  /**
   * Check if a step should be checkpointed
   * INV-CP-MGR-002: Deterministic based on config
   */
  shouldCheckpoint(stepIndex: number): boolean;
}

// ============================================================================
// Delegation Tracker Port
// ============================================================================

/**
 * Delegation Tracker Port Interface
 *
 * Tracks agent delegation chains to prevent infinite loops and circular delegation.
 *
 * INV-DT-001: Maximum delegation depth enforced
 * INV-DT-002: Circular delegations prevented (agent cannot delegate to itself or ancestors)
 */
export interface DelegationTrackerPort {
  /**
   * Check if delegation is allowed
   * INV-DT-001: Returns false if max depth exceeded
   * INV-DT-002: Returns false if circular delegation detected
   */
  canDelegate(fromAgent: string, toAgent: string): boolean;

  /**
   * Record a delegation
   */
  recordDelegation(fromAgent: string, toAgent: string): void;

  /**
   * Get current delegation depth for an agent
   */
  getCurrentDepth(agentId: string): number;

  /**
   * Get the delegation chain for an agent
   */
  getChain(agentId: string): string[];

  /**
   * Check if an agent is in the current delegation chain (circular detection)
   */
  isInChain(agentId: string): boolean;

  /**
   * Complete a delegation (pop from chain)
   */
  completeDelegation(agentId: string): void;
}

// ============================================================================
// Dead Letter Queue Port
// ============================================================================

// Re-export DeadLetterEntry from cross-cutting for convenience
export type { DeadLetterEntry } from '../../cross-cutting/v1/dead-letter.js';
import type { DeadLetterEntry } from '../../cross-cutting/v1/dead-letter.js';

/**
 * Dead Letter Queue Port Interface
 *
 * Captures failed events for later retry or manual intervention.
 *
 * INV-DLQ-001: All failed events captured with full context
 * INV-DLQ-002: Retries respect maxRetries limit
 * INV-DLQ-003: Exhausted entries marked appropriately
 */
export interface DeadLetterQueuePort {
  /**
   * Add a failed event to the queue
   * INV-DLQ-001: Captures full context
   */
  add(
    event: unknown,
    error: string,
    errorCode: string,
    maxRetries?: number
  ): Promise<DeadLetterEntry>;

  /**
   * Get pending entries for retry
   */
  getPending(limit?: number): Promise<DeadLetterEntry[]>;

  /**
   * Mark entry as retried
   * INV-DLQ-002: Respects maxRetries
   * INV-DLQ-003: Marks as exhausted when max reached
   */
  markRetried(id: string, success: boolean, error?: string): Promise<void>;

  /**
   * Get entry by ID
   */
  get(id: string): Promise<DeadLetterEntry | null>;

  /**
   * Count entries by status
   */
  countByStatus(): Promise<Record<string, number>>;

  /**
   * Purge old resolved/exhausted entries
   */
  purge(olderThanMs: number): Promise<number>;
}
