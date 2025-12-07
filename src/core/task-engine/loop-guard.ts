/**
 * Loop Guard - Recursive Loop Prevention
 *
 * Prevents recursive loops in task execution by tracking:
 * - Call chain depth
 * - Self-calls (circular references)
 * - Chain length
 * - Blocked patterns
 *
 * CRITICAL: This is a Day-1 safety feature. All task executions
 * MUST pass through LoopGuard.validateExecution() before routing.
 *
 * @module core/task-engine/loop-guard
 * @version 1.0.0
 */

import {
  type TaskContext,
  type LoopGuardConfig,
  type OriginClient,
  LoopPreventionError
} from './types';

/**
 * Default blocked patterns
 *
 * Pattern: automatosx.*automatosx
 * Blocks: Any call chain that goes through AutomatosX twice
 * Example: claude → automatosx → gemini → automatosx (BLOCKED)
 */
const DEFAULT_BLOCKED_PATTERNS: RegExp[] = [
  // Prevent recursive hub pattern
  /automatosx.*automatosx/
];

/**
 * Client name normalization mapping
 */
const CLIENT_NORMALIZATION_MAP: Record<string, OriginClient> = {
  // Claude variants
  'claude': 'claude-code',
  'claude-code': 'claude-code',
  'claudecode': 'claude-code',
  'anthropic': 'claude-code',

  // Gemini variants
  'gemini': 'gemini-cli',
  'gemini-cli': 'gemini-cli',
  'geminicli': 'gemini-cli',
  'google': 'gemini-cli',

  // Codex variants
  'codex': 'codex-cli',
  'codex-cli': 'codex-cli',
  'openai': 'codex-cli',
  'gpt': 'codex-cli',

  // v12.0.0: GLM and Grok (replacing ax-cli)
  'glm': 'glm',
  'zhipu': 'glm',
  'ax-glm': 'glm',
  'grok': 'grok',
  'xai': 'grok',
  'ax-grok': 'grok'
};

/**
 * LoopGuard - Prevents recursive loops in task execution
 *
 * @example
 * ```typescript
 * const guard = new LoopGuard();
 * const ctx = guard.createContext('claude-code');
 *
 * // Before executing a task
 * guard.validateExecution(ctx, 'gemini'); // OK
 *
 * // Extend context for nested calls
 * const nestedCtx = guard.extendContext(ctx, 'gemini');
 * guard.validateExecution(nestedCtx, 'codex'); // OK
 *
 * // This would throw LoopPreventionError:
 * guard.validateExecution(nestedCtx, 'gemini'); // ERROR: circular
 * ```
 */
export class LoopGuard {
  private readonly config: Required<LoopGuardConfig>;

  constructor(config: Partial<LoopGuardConfig> = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 2,
      maxChainLength: config.maxChainLength ?? 5,
      blockSelfCalls: config.blockSelfCalls ?? true,
      blockedPatterns: config.blockedPatterns ?? DEFAULT_BLOCKED_PATTERNS
    };

    // Validate configuration
    if (this.config.maxDepth < 1 || this.config.maxDepth > 10) {
      throw new Error('LoopGuard: maxDepth must be between 1 and 10');
    }
    if (this.config.maxChainLength < 2 || this.config.maxChainLength > 20) {
      throw new Error('LoopGuard: maxChainLength must be between 2 and 20');
    }
  }

  /**
   * Validate that a task execution is allowed
   *
   * @param ctx - Current task context
   * @param targetEngine - Engine to route the task to
   * @throws {LoopPreventionError} If execution would cause a loop
   */
  validateExecution(ctx: TaskContext, targetEngine: string): void {
    const normalizedTarget = this.normalizeClient(targetEngine);
    const projectedChain = [...ctx.callChain, 'automatosx', normalizedTarget];

    // Rule 1: Depth check
    // Current depth + 1 (for this call) must not exceed maxDepth
    if (ctx.depth >= this.config.maxDepth) {
      throw new LoopPreventionError(
        `Maximum depth exceeded: current depth ${ctx.depth} >= limit ${this.config.maxDepth}`,
        projectedChain,
        'DEPTH_EXCEEDED'
      );
    }

    // Rule 2: Self-call check (circular reference)
    // Cannot call an engine that's already in the call chain
    if (this.config.blockSelfCalls) {
      // Check if target engine already exists in the chain
      const engineInChain = ctx.callChain.some(
        entry => this.normalizeClient(entry) === normalizedTarget
      );

      if (engineInChain) {
        throw new LoopPreventionError(
          `Circular call detected: ${normalizedTarget} already in chain [${ctx.callChain.join(' → ')}]`,
          projectedChain,
          'LOOP_DETECTED'
        );
      }
    }

    // Rule 3: Chain length check
    // Projected chain (with automatosx + target) must not exceed limit
    if (projectedChain.length > this.config.maxChainLength) {
      throw new LoopPreventionError(
        `Call chain too long: ${projectedChain.length} > ${this.config.maxChainLength}`,
        projectedChain,
        'CHAIN_TOO_LONG'
      );
    }

    // Rule 4: Blocked pattern check
    const chainString = projectedChain.join('→');
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(chainString)) {
        throw new LoopPreventionError(
          `Blocked pattern matched: ${chainString} matches ${pattern.toString()}`,
          projectedChain,
          'BLOCKED_PATTERN'
        );
      }
    }
  }

  /**
   * Create a new task context for an incoming request
   *
   * @param originClient - The client that initiated the request
   * @param taskId - Optional task ID (will be set later if not provided)
   * @returns New task context
   */
  createContext(originClient: string, taskId: string = ''): TaskContext {
    const normalized = this.normalizeClient(originClient);

    return {
      taskId,
      originClient: normalized,
      callChain: [normalized],
      depth: 0,
      maxDepth: this.config.maxDepth,
      createdAt: Date.now()
    };
  }

  /**
   * Extend a task context for a nested call
   *
   * @param ctx - Current task context
   * @param engine - Engine being called
   * @returns Extended task context
   */
  extendContext(ctx: TaskContext, engine: string): TaskContext {
    const normalizedEngine = this.normalizeClient(engine);

    return {
      ...ctx,
      callChain: [...ctx.callChain, 'automatosx', normalizedEngine],
      depth: ctx.depth + 1,
      createdAt: Date.now()
    };
  }

  /**
   * Merge an incoming context with the current context
   * Used when a task already has context from a previous hop
   *
   * @param incomingCtx - Context from incoming request
   * @param currentOrigin - Current origin (automatosx)
   * @returns Merged context
   */
  mergeContext(incomingCtx: Partial<TaskContext>, currentOrigin: string = 'automatosx'): TaskContext {
    const callChain = incomingCtx.callChain ?? [];
    const originClient = incomingCtx.originClient ?? 'unknown';

    // If incoming context has a call chain, use it
    // Otherwise, create a new chain with the origin
    const mergedChain = callChain.length > 0
      ? [...callChain, currentOrigin]
      : [originClient, currentOrigin];

    return {
      taskId: incomingCtx.taskId ?? '',
      originClient: this.normalizeClient(originClient),
      callChain: mergedChain,
      depth: (incomingCtx.depth ?? 0) + 1,
      maxDepth: this.config.maxDepth,
      createdAt: Date.now()
    };
  }

  /**
   * Get a human-readable representation of the call chain
   *
   * @param ctx - Task context
   * @returns Formatted call chain string
   */
  getCallChainString(ctx: TaskContext): string {
    return ctx.callChain.join(' → ');
  }

  /**
   * Check if a context is valid (not expired or corrupted)
   *
   * @param ctx - Task context to validate
   * @returns true if context is valid
   */
  isValidContext(ctx: unknown): ctx is TaskContext {
    if (!ctx || typeof ctx !== 'object') {
      return false;
    }

    const context = ctx as Record<string, unknown>;

    return (
      typeof context.taskId === 'string' &&
      typeof context.originClient === 'string' &&
      Array.isArray(context.callChain) &&
      context.callChain.every(item => typeof item === 'string') &&
      typeof context.depth === 'number' &&
      Number.isInteger(context.depth) &&
      context.depth >= 0 &&
      typeof context.maxDepth === 'number' &&
      typeof context.createdAt === 'number'
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<LoopGuardConfig> {
    return { ...this.config };
  }

  /**
   * Normalize client name to standard format
   *
   * IMPORTANT: Unknown engines are preserved as-is (normalized formatting only)
   * to prevent false-positive loop detection when two different unknown engines
   * would both map to 'unknown' and trigger a circular call error.
   */
  private normalizeClient(client: string): OriginClient {
    if (!client || typeof client !== 'string') {
      return 'unknown';
    }

    const normalized = client.toLowerCase().trim().replace(/[\s-_]+/g, '-');

    // If it's a known client, use the standard mapping
    if (CLIENT_NORMALIZATION_MAP[normalized]) {
      return CLIENT_NORMALIZATION_MAP[normalized];
    }

    // For unknown engines, preserve the normalized name to avoid
    // false-positive loop detection (e.g., 'engine-a' vs 'engine-b'
    // should NOT both become 'unknown' and trigger circular call error)
    return normalized as OriginClient;
  }
}

/**
 * Default loop guard instance (singleton pattern)
 */
let defaultLoopGuard: LoopGuard | null = null;

/**
 * Get the default loop guard instance
 */
export function getLoopGuard(): LoopGuard {
  if (!defaultLoopGuard) {
    defaultLoopGuard = new LoopGuard();
  }
  return defaultLoopGuard;
}

/**
 * Reset the default loop guard (for testing)
 */
export function resetLoopGuard(): void {
  defaultLoopGuard = null;
}

/**
 * Create a new loop guard with custom configuration
 */
export function createLoopGuard(config?: Partial<LoopGuardConfig>): LoopGuard {
  return new LoopGuard(config);
}
