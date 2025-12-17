/**
 * Dangerous Operation Guard
 *
 * Provides confirmation gates for potentially destructive operations.
 * Prevents accidental data loss by requiring explicit confirmation.
 */

import * as readline from 'readline';
import {
  DANGEROUS_OPERATIONS,
  getDangerousOperation,
  type DangerousOpCheckResult,
  type DangerousOperation,
  CLIErrorCodes,
} from '@automatosx/contracts';

export interface DangerousOpOptions {
  /** Skip confirmation (--force flag) */
  force?: boolean;
  /** Accept all prompts (--yes flag) */
  yes?: boolean;
  /** Non-interactive mode */
  noPrompt?: boolean;
}

/**
 * Check if a dangerous operation should proceed
 *
 * @param operationId - The operation identifier (e.g., 'cleanup.force')
 * @param options - Options that may bypass confirmation
 * @returns Result indicating if the operation is allowed
 */
export async function checkDangerousOp(
  operationId: string,
  options: DangerousOpOptions
): Promise<DangerousOpCheckResult> {
  const op = getDangerousOperation(operationId);

  // Not a dangerous operation - allow
  if (!op) {
    return { allowed: true };
  }

  // Skip if --force or --yes
  if (options.force || options.yes) {
    console.warn(`Warning: Bypassing confirmation for ${op.operation}`);
    return {
      allowed: true,
      operation: op.operation,
      impact: op.impact,
    };
  }

  // Check if we're in non-interactive mode
  if (options.noPrompt || !process.stdin.isTTY) {
    return {
      allowed: false,
      reason: 'Dangerous operation requires --force flag in non-interactive mode',
      operation: op.operation,
      impact: op.impact,
    };
  }

  // Show warning and prompt for confirmation
  return promptForConfirmation(op);
}

/**
 * Prompt user for confirmation of dangerous operation
 */
async function promptForConfirmation(
  op: DangerousOperation
): Promise<DangerousOpCheckResult> {
  console.log('');
  console.log(`[WARNING] ${op.description}`);
  console.log(`Impact: ${op.impact.toUpperCase()}`);
  console.log('');

  // Require specific phrase for critical operations
  if (op.confirmationPhrase) {
    const answer = await prompt(`Type "${op.confirmationPhrase}" to confirm: `);
    if (answer !== op.confirmationPhrase) {
      return {
        allowed: false,
        reason: 'Confirmation phrase did not match',
        operation: op.operation,
        impact: op.impact,
      };
    }
    return {
      allowed: true,
      operation: op.operation,
      impact: op.impact,
    };
  }

  // Simple y/N confirmation for other operations
  const answer = await prompt('Continue? [y/N]: ');
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    return {
      allowed: false,
      reason: 'User cancelled',
      operation: op.operation,
      impact: op.impact,
    };
  }

  return {
    allowed: true,
    operation: op.operation,
    impact: op.impact,
  };
}

/**
 * Prompt for user input
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * List all dangerous operations
 */
export function listDangerousOperations(): DangerousOperation[] {
  return Object.values(DANGEROUS_OPERATIONS);
}

/**
 * Check if an operation ID corresponds to a dangerous operation
 */
export function isDangerousOp(operationId: string): boolean {
  return operationId in DANGEROUS_OPERATIONS;
}

export { DANGEROUS_OPERATIONS, CLIErrorCodes };
