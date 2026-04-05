import { createHash } from 'node:crypto';
import { CheckpointRecordSchema, type CheckpointRecord } from '@defai.digital/contracts';
import type { StepResult } from './types.js';

/**
 * Recursively serialize a value with sorted object keys for deterministic output.
 * Matches JSON.stringify semantics: undefined values in objects are omitted,
 * undefined in arrays becomes "null".
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    // JSON.stringify converts undefined array elements to null
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    // JSON.stringify omits keys with undefined values
    const entries: string[] = [];
    for (const key of keys) {
      const v = obj[key];
      if (v !== undefined) {
        entries.push(`${JSON.stringify(key)}:${stableStringify(v)}`);
      }
    }
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Compute a deterministic hash of a workflow definition for drift detection.
 * Uses recursive stable serialization with sorted keys at every nesting level.
 */
export function computeWorkflowHash(workflow: unknown): string {
  const serialized = stableStringify(workflow);
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}

/**
 * INV-CP-001: Validate checkpoint data integrity.
 * Returns null if valid, or an error message if invalid.
 */
export function validateCheckpoint(
  checkpoint: CheckpointRecord,
  stepResults: StepResult[],
): string | null {
  const parseResult = CheckpointRecordSchema.safeParse(checkpoint);
  if (!parseResult.success) {
    return `Checkpoint schema validation failed: ${parseResult.error.message}`;
  }

  if (checkpoint.lastCompletedStepIndex < 0) {
    return `INV-CP-001: lastCompletedStepIndex must be >= 0`;
  }

  // The lastCompletedStepId must correspond to a successful step in the results
  const matchingStep = stepResults.find(
    (r) => r.stepId === checkpoint.lastCompletedStepId && r.success,
  );
  if (matchingStep === undefined) {
    return `INV-CP-001: lastCompletedStepId (${checkpoint.lastCompletedStepId}) not found as a successful step in results`;
  }

  // Every successful step should have an entry in stepOutputs (key presence, value may be undefined)
  for (const result of stepResults) {
    if (result.success && !Object.prototype.hasOwnProperty.call(checkpoint.stepOutputs, result.stepId)) {
      return `INV-CP-001: successful step ${result.stepId} missing from stepOutputs`;
    }
  }

  const ts = Date.parse(checkpoint.checkpointedAt);
  if (Number.isNaN(ts) || ts > Date.now() + 60_000) {
    return `INV-CP-001: checkpointedAt is invalid or in the future`;
  }

  return null;
}

/**
 * INV-CP-002: Enforce checkpoint ordering — monotonically increasing step index.
 * Returns true if the new checkpoint is valid (strictly greater than previous).
 */
export function isCheckpointOrdered(
  previousIndex: number,
  newIndex: number,
): boolean {
  return newIndex > previousIndex;
}

/**
 * Build a CheckpointRecord from the current execution state.
 * @param stepResults All accumulated step results (including failures).
 * @param workflowHash Deterministic hash of the workflow definition.
 * @param lastCompletedWorkflowStepIndex The workflow-level index (loop counter) of the
 *   last successfully completed step. This must correspond to the step's position in the
 *   original workflow.steps array, NOT a filtered subset.
 * @param lastCompletedStepId The stepId of the last successfully completed step.
 */
export function buildCheckpointRecord(
  stepResults: StepResult[],
  workflowHash: string,
  lastCompletedWorkflowStepIndex: number,
  lastCompletedStepId: string,
): CheckpointRecord {
  const stepOutputs: Record<string, unknown> = {};
  for (const result of stepResults) {
    if (result.success) {
      // Use null instead of undefined so JSON.stringify preserves the key
      stepOutputs[result.stepId] = result.output ?? null;
    }
  }

  return {
    lastCompletedStepIndex: lastCompletedWorkflowStepIndex,
    lastCompletedStepId,
    checkpointedAt: new Date().toISOString(),
    workflowHash,
    stepOutputs,
  };
}
