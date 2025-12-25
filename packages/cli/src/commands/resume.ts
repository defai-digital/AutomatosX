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
  const extendedOptions = options as unknown as Record<string, unknown>;
  if (args[0] === 'list' || extendedOptions.list) {
    return listCheckpoints(options);
  }

  // Parse and validate options
  const opts = extractResumeOptions(options);
  const validation = safeValidateResumeOptions(opts);

  if (!validation.success) {
    return {
      success: false,
      exitCode: 1,
      message: `Invalid options: ${validation.error.errors.map((e) => e.message).join(', ')}`,
      data: undefined,
    };
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
    return {
      success: false,
      exitCode: 1,
      message: 'Please specify --agent or --checkpoint. Use "ax resume list --agent=<id>" to see available checkpoints.',
      data: undefined,
    };
  }

  if (!checkpoint) {
    return {
      success: false,
      exitCode: 1,
      message: resumeOpts.checkpointId
        ? `Checkpoint not found: ${resumeOpts.checkpointId}`
        : `No checkpoint found for agent: ${resumeOpts.agentId}`,
      data: undefined,
    };
  }

  // Check if expired
  if (checkpoint.expiresAt && new Date(checkpoint.expiresAt) < new Date()) {
    return {
      success: false,
      exitCode: 1,
      message: `Checkpoint ${checkpoint.checkpointId} has expired (${formatAge(checkpoint.expiresAt)})`,
      data: undefined,
    };
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
    return {
      success: false,
      exitCode: 1,
      message: 'Failed to create resume context',
      data: undefined,
    };
  }

  // Return success with resume info
  // Note: Actual execution integration would happen here
  return {
    success: true,
    exitCode: 0,
    message: options.format === 'json'
      ? undefined
      : `Ready to resume from step ${resumeContext.startFromStep}`,
    data: {
      checkpointId: checkpoint.checkpointId,
      agentId: checkpoint.agentId,
      startFromStep: resumeContext.startFromStep,
      previousStepsCompleted: checkpoint.stepIndex,
      context: resumeContext.context,
    },
  };
}

/**
 * List available checkpoints for an agent
 */
async function listCheckpoints(options: CLIOptions): Promise<CommandResult> {
  const extendedOptions = options as unknown as Record<string, unknown>;
  const agentId = extendedOptions.agent as string | undefined;

  if (!agentId) {
    return {
      success: false,
      exitCode: 1,
      message: 'Please specify --agent to list checkpoints',
      data: undefined,
    };
  }

  const storage = getCheckpointStorage();
  const checkpoints = await storage.list(agentId);

  if (checkpoints.length === 0) {
    return {
      success: true,
      exitCode: 0,
      message: `No checkpoints found for agent: ${agentId}`,
      data: { checkpoints: [] },
    };
  }

  // Format for JSON output
  if (options.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      message: undefined,
      data: {
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
      },
    };
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

  return {
    success: true,
    exitCode: 0,
    message: undefined,
    data: { checkpoints },
  };
}

/**
 * Extract resume options from CLI options
 */
function extractResumeOptions(options: CLIOptions): Partial<ResumeOptions> {
  const opts = options as unknown as Record<string, unknown>;
  return {
    checkpointId: opts.checkpoint as string | undefined,
    agentId: opts.agent as string | undefined,
    sessionId: opts.session as string | undefined,
    force: opts.force === true,
    format: options.format,
  };
}

/**
 * Format a datetime as human-readable age
 */
function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
