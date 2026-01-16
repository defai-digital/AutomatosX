/**
 * Resume Command
 *
 * Resume agent execution from a checkpoint.
 * Leverages the existing checkpoint-manager from @defai.digital/agent-execution.
 *
 * Usage:
 *   ax resume                          # Resume latest checkpoint (requires --agent)
 *   ax resume --agent=coder            # Resume latest for specific agent
 *   ax resume --checkpoint=<uuid>      # Resume specific checkpoint
 *   ax resume list --agent=coder       # List available checkpoints
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { createCheckpointManager } from '@defai.digital/agent-execution';
import {
  safeValidateResumeOptions,
  type ResumeOptions,
  type Checkpoint,
} from '@defai.digital/contracts';
import {
  getCheckpointStorage,
  initializeStorageAsync,
} from '../utils/storage-instances.js';
import { formatAge } from '../utils/formatters.js';
import { success, failure } from '../utils/command-result.js';

/**
 * Resume command handler
 */
export async function resumeCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Initialize storage (enables SQLite if available)
  await initializeStorageAsync();

  // Handle list subcommand
  const extOpts = options as unknown as Record<string, unknown>;
  if (args[0] === 'list' || extOpts.list) {
    return listCheckpoints(options);
  }

  // Parse and validate options
  const opts = extractResumeOptions(options);
  const validation = safeValidateResumeOptions(opts);

  if (!validation.success) {
    return failure(`Invalid options: ${validation.error.errors.map((e) => e.message).join(', ')}`);
  }

  const resumeOpts = validation.data;
  const storage = getCheckpointStorage();

  // Get checkpoint to resume
  let checkpoint: Checkpoint | null = null;

  if (resumeOpts.checkpointId) {
    checkpoint = await storage.load(resumeOpts.checkpointId);
  } else if (resumeOpts.agentId) {
    checkpoint = await storage.loadLatest(resumeOpts.agentId, resumeOpts.sessionId);
  } else {
    return failure('Please specify --agent or --checkpoint. Use "ax resume list --agent=<id>" to see available checkpoints.');
  }

  if (!checkpoint) {
    const msg = resumeOpts.checkpointId
      ? `Checkpoint not found: ${resumeOpts.checkpointId}`
      : `No checkpoint found for agent: ${resumeOpts.agentId}`;
    return failure(msg);
  }

  // Check if expired
  if (checkpoint.expiresAt && new Date(checkpoint.expiresAt) < new Date()) {
    return failure(`Checkpoint ${checkpoint.checkpointId} has expired (${formatAge(checkpoint.expiresAt)})`);
  }

  // Display checkpoint info
  if (!resumeOpts.force && options.format !== 'json') {
    console.log('');
    console.log('Resuming from checkpoint:');
    console.log(`  ID:      ${checkpoint.checkpointId.slice(0, 8)}...`);
    console.log(`  Agent:   ${checkpoint.agentId}`);
    console.log(`  Step:    ${checkpoint.stepIndex} (${checkpoint.completedStepId})`);
    console.log(`  Created: ${formatAge(checkpoint.createdAt)}`);
    console.log('');
    console.log(`This will continue execution from step ${checkpoint.stepIndex + 1}.`);
  }

  // Create manager and get resume context
  const manager = createCheckpointManager(
    checkpoint.agentId,
    checkpoint.sessionId,
    storage
  );

  const resumeContext = await manager.getResumeContext(checkpoint.checkpointId);
  if (!resumeContext) {
    return failure('Failed to create resume context');
  }

  // Return success with resume info
  // Note: Actual execution integration would happen here
  const resumeData = {
    checkpointId: checkpoint.checkpointId,
    agentId: checkpoint.agentId,
    startFromStep: resumeContext.startFromStep,
    previousStepsCompleted: checkpoint.stepIndex,
    context: resumeContext.context,
  };
  const message = options.format === 'json'
    ? undefined
    : `Ready to resume from step ${resumeContext.startFromStep}`;
  return success(resumeData, message);
}

/**
 * List available checkpoints for an agent
 */
async function listCheckpoints(options: CLIOptions): Promise<CommandResult> {
  const extOpts = options as unknown as Record<string, unknown>;
  const agentId = extOpts.agent as string | undefined;

  if (!agentId) {
    return failure('Please specify --agent to list checkpoints');
  }

  const storage = getCheckpointStorage();
  const checkpoints = await storage.list(agentId);

  if (checkpoints.length === 0) {
    return success({ checkpoints: [] }, `No checkpoints found for agent: ${agentId}`);
  }

  // Format for JSON output
  if (options.format === 'json') {
    const jsonData = {
      checkpoints: checkpoints.map((cp: Checkpoint) => ({
        checkpointId: cp.checkpointId,
        agentId: cp.agentId,
        sessionId: cp.sessionId,
        stepIndex: cp.stepIndex,
        completedStepId: cp.completedStepId,
        createdAt: cp.createdAt,
        expiresAt: cp.expiresAt,
        age: formatAge(cp.createdAt),
      })),
    };
    return success(jsonData);
  }

  // Format for text output
  console.log('');
  console.log(`Checkpoints for agent: ${agentId}`);
  console.log('');
  console.log('ID        Step                    Created     Expires');
  console.log('--------  ----------------------  ----------  ----------');

  for (const cp of checkpoints) {
    const id = cp.checkpointId.slice(0, 8);
    const step = `${cp.stepIndex} (${cp.completedStepId})`.slice(0, 22).padEnd(22);
    const created = formatAge(cp.createdAt).padEnd(10);
    const expires = cp.expiresAt ? formatAge(cp.expiresAt) : 'never';

    console.log(`${id}  ${step}  ${created}  ${expires}`);
  }

  console.log('');

  return success({ checkpoints });
}

/**
 * Extract resume options from CLI options
 */
function extractResumeOptions(options: CLIOptions): Partial<ResumeOptions> {
  const rawOpts = options as unknown as Record<string, unknown>;
  return {
    checkpointId: rawOpts.checkpoint as string | undefined,
    agentId: rawOpts.agent as string | undefined,
    sessionId: rawOpts.session as string | undefined,
    force: rawOpts.force === true,
    format: options.format,
  };
}

