/**
 * Stub Delegation Tracker Implementation
 *
 * Provides a minimal delegation tracker for when no real implementation
 * is provided via AgentDomainConfig.delegationTrackerFactory.
 *
 * This stub:
 * - Logs a warning on first use
 * - Allows delegations within depth limits
 * - Tracks basic context and history
 *
 * For production use, provide a real implementation via config.
 */

import type {
  DelegationContext,
  DelegationCheckResult,
  DelegationResult,
  DelegationRequest as ContractDelegationRequest,
} from '@automatosx/contracts';
import {
  createRootDelegationContext,
  DelegationErrorCodes,
} from '@automatosx/contracts';
import type { DelegationTrackerPort, DelegationTrackerFactory } from './types.js';

let _warnedOnce = false;

/**
 * Creates a stub delegation tracker
 *
 * This is used when no delegationTrackerFactory is provided in config.
 * It provides basic functionality but logs a warning.
 */
function createStubDelegationTracker(
  agentId: string,
  parentContext: DelegationContext | undefined,
  maxDepth: number
): DelegationTrackerPort {
  // Warn once about stub usage
  if (!_warnedOnce) {
    console.warn(
      '[agent-domain] Using stub delegation tracker. ' +
      'For full delegation support, provide delegationTrackerFactory in AgentDomainConfig.'
    );
    _warnedOnce = true;
  }

  // Initialize context
  let context: DelegationContext;

  if (parentContext) {
    // Create child context
    context = {
      ...parentContext,
      currentDepth: parentContext.currentDepth + 1,
      delegationChain: [...parentContext.delegationChain, agentId],
    };
  } else {
    // Create root context
    context = createRootDelegationContext(
      agentId,
      crypto.randomUUID(),
      maxDepth
    );
  }

  const delegationHistory: DelegationResult[] = [];

  return {
    getContext(): DelegationContext {
      return { ...context };
    },

    canDelegate(toAgentId: string): DelegationCheckResult {
      // INV-DT-001: Check depth limit
      if (context.currentDepth >= context.maxDepth) {
        return {
          allowed: false,
          reason: DelegationErrorCodes.MAX_DEPTH_EXCEEDED,
          message: `Maximum delegation depth ${context.maxDepth} reached`,
        };
      }

      // INV-DT-002: Check for circular delegation
      if (context.delegationChain.includes(toAgentId)) {
        return {
          allowed: false,
          reason: DelegationErrorCodes.CIRCULAR_DELEGATION,
          message: `Cannot delegate to ${toAgentId} - already in delegation chain`,
        };
      }

      return {
        allowed: true,
        reason: 'ALLOWED',
        message: `Delegation to ${toAgentId} is allowed`,
      };
    },

    createDelegationRequest(
      toAgentId: string,
      task: string,
      input?: unknown,
      timeout?: number
    ): ContractDelegationRequest | null {
      const checkResult = this.canDelegate(toAgentId);
      if (!checkResult.allowed) {
        return null;
      }

      return {
        fromAgentId: agentId,
        toAgentId,
        task,
        input,
        timeout,
        context,
      };
    },

    createChildContext(toAgentId: string): DelegationContext {
      return {
        ...context,
        currentDepth: context.currentDepth + 1,
        delegationChain: [...context.delegationChain, toAgentId],
      };
    },

    recordResult(result: DelegationResult): void {
      delegationHistory.push(result);
    },

    getHistory(): DelegationResult[] {
      return [...delegationHistory];
    },

    isRoot(): boolean {
      return context.currentDepth === 0;
    },

    getRemainingDepth(): number {
      return context.maxDepth - context.currentDepth;
    },
  };
}

/**
 * Stub delegation tracker factory
 *
 * Use this as a fallback when no factory is provided in config.
 */
export const stubDelegationTrackerFactory: DelegationTrackerFactory =
  createStubDelegationTracker;

/**
 * Reset the warning flag (for testing)
 */
export function resetStubWarning(): void {
  _warnedOnce = false;
}
