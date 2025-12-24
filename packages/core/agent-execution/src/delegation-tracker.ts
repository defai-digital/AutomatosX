/**
 * Delegation Tracker Implementation
 *
 * Tracks agent delegation chains and validates delegation requests.
 * Prevents circular delegations and enforces depth limits.
 *
 * Invariants:
 * - INV-DT-001: Depth never exceeds maxDepth
 * - INV-DT-002: No circular delegations
 */

import {
  type DelegationContext,
  type DelegationRequest,
  type DelegationResult,
  type DelegationCheckResult,
  createRootDelegationContext,
  DelegationErrorCodes,
} from '@automatosx/contracts';

/**
 * Delegation tracker for managing delegation chains
 */
export interface DelegationTracker {
  /** Get current delegation context */
  getContext(): DelegationContext;

  /** Check if delegation to target agent is allowed */
  canDelegate(toAgentId: string): DelegationCheckResult;

  /** Create delegation request */
  createDelegationRequest(
    toAgentId: string,
    task: string,
    input?: unknown,
    timeout?: number
  ): DelegationRequest | null;

  /** Create child context for delegated agent */
  createChildContext(toAgentId: string): DelegationContext;

  /** Record delegation result */
  recordResult(result: DelegationResult): void;

  /** Get delegation history */
  getHistory(): DelegationResult[];

  /** Check if we're at the root of delegation chain */
  isRoot(): boolean;

  /** Get remaining delegation depth */
  getRemainingDepth(): number;
}

/**
 * Creates a delegation tracker
 */
export function createDelegationTracker(
  agentId: string,
  parentContext?: DelegationContext,
  maxDepth = 3
): DelegationTracker {
  // Initialize context - either from parent or create new root
  let context: DelegationContext;

  if (parentContext) {
    // Validate parent context
    if (parentContext.currentDepth >= parentContext.maxDepth) {
      throw new DelegationError(
        DelegationErrorCodes.MAX_DEPTH_EXCEEDED,
        agentId,
        `Max delegation depth ${parentContext.maxDepth} exceeded`
      );
    }

    // Create context for this agent
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

      return { allowed: true };
    },

    createDelegationRequest(
      toAgentId: string,
      task: string,
      input?: unknown,
      timeout?: number
    ): DelegationRequest | null {
      const check = this.canDelegate(toAgentId);
      if (!check.allowed) {
        return null;
      }

      return {
        fromAgentId: agentId,
        toAgentId,
        task,
        context: this.getContext(),
        timeout,
        input,
      };
    },

    createChildContext(toAgentId: string): DelegationContext {
      // Check first
      const check = this.canDelegate(toAgentId);
      if (!check.allowed) {
        throw new DelegationError(
          check.reason ?? DelegationErrorCodes.PERMISSION_DENIED,
          toAgentId,
          check.message
        );
      }

      return {
        currentDepth: context.currentDepth + 1,
        maxDepth: context.maxDepth,
        delegationChain: [...context.delegationChain, toAgentId],
        initiatorAgentId: context.initiatorAgentId,
        rootTaskId: context.rootTaskId,
        startedAt: context.startedAt,
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
 * Validates a delegation request
 */
export function validateDelegationRequest(
  request: DelegationRequest
): DelegationCheckResult {
  const { context, toAgentId, fromAgentId } = request;

  // Check self-delegation
  if (fromAgentId === toAgentId) {
    return {
      allowed: false,
      reason: DelegationErrorCodes.CIRCULAR_DELEGATION,
      message: 'Agent cannot delegate to itself',
    };
  }

  // Check depth limit
  if (context.currentDepth >= context.maxDepth) {
    return {
      allowed: false,
      reason: DelegationErrorCodes.MAX_DEPTH_EXCEEDED,
      message: `Maximum delegation depth ${context.maxDepth} exceeded`,
    };
  }

  // Check circular delegation
  if (context.delegationChain.includes(toAgentId)) {
    return {
      allowed: false,
      reason: DelegationErrorCodes.CIRCULAR_DELEGATION,
      message: `Agent ${toAgentId} already in delegation chain`,
    };
  }

  return { allowed: true };
}

/**
 * Creates a delegation result for success
 */
export function createSuccessResult(
  handledBy: string,
  result: unknown,
  durationMs: number,
  finalDepth: number
): DelegationResult {
  return {
    success: true,
    handledBy,
    result,
    durationMs,
    finalDepth,
  };
}

/**
 * Creates a delegation result for failure
 */
export function createFailureResult(
  handledBy: string,
  errorCode: string,
  errorMessage: string,
  durationMs: number,
  finalDepth: number
): DelegationResult {
  return {
    success: false,
    handledBy,
    error: {
      code: errorCode,
      message: errorMessage,
      retryable: false,
    },
    durationMs,
    finalDepth,
  };
}

/**
 * Delegation error
 */
export class DelegationError extends Error {
  constructor(
    public readonly code: string,
    public readonly targetAgent: string,
    message?: string
  ) {
    super(message ?? `Delegation error: ${code}`);
    this.name = 'DelegationError';
  }

  static maxDepthExceeded(
    targetAgent: string,
    maxDepth: number
  ): DelegationError {
    return new DelegationError(
      DelegationErrorCodes.MAX_DEPTH_EXCEEDED,
      targetAgent,
      `Maximum delegation depth ${maxDepth} exceeded when delegating to ${targetAgent}`
    );
  }

  static circularDelegation(targetAgent: string): DelegationError {
    return new DelegationError(
      DelegationErrorCodes.CIRCULAR_DELEGATION,
      targetAgent,
      `Circular delegation detected: ${targetAgent} is already in the delegation chain`
    );
  }

  static timeout(targetAgent: string, timeoutMs: number): DelegationError {
    return new DelegationError(
      DelegationErrorCodes.TIMEOUT,
      targetAgent,
      `Delegation to ${targetAgent} timed out after ${timeoutMs}ms`
    );
  }

  static targetNotFound(targetAgent: string): DelegationError {
    return new DelegationError(
      DelegationErrorCodes.TARGET_NOT_FOUND,
      targetAgent,
      `Delegation target agent not found: ${targetAgent}`
    );
  }
}
