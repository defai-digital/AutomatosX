/**
 * Resource Enforcer Implementation
 *
 * Enforces limits on tokens, time, cost, and concurrency.
 */

import {
  type ResourceLimitsConfig,
  type ResourceUsage,
  type ResourceCheckResult,
  type ResourceRequestInfo,
  ResourceLimitsErrorCodes,
  createDefaultResourceLimitsConfig,
  createResourceUsage,
  estimateCost,
} from './_contracts.js';

/**
 * Resource enforcer error
 */
export class ResourceEnforcerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly limit: string,
    public readonly current: number,
    public readonly max: number
  ) {
    super(message);
    this.name = 'ResourceEnforcerError';
  }

  static fromCheckResult(
    result: ResourceCheckResult & { allowed: false }
  ): ResourceEnforcerError {
    const codeMap: Record<string, string> = {
      'tokens-per-request': ResourceLimitsErrorCodes.TOKENS_PER_REQUEST_EXCEEDED,
      'tokens-per-session': ResourceLimitsErrorCodes.TOKENS_PER_SESSION_EXCEEDED,
      'duration': ResourceLimitsErrorCodes.DURATION_EXCEEDED,
      'cost': ResourceLimitsErrorCodes.COST_EXCEEDED,
      'concurrency': ResourceLimitsErrorCodes.CONCURRENCY_EXCEEDED,
    };

    return new ResourceEnforcerError(
      codeMap[result.limitType] ?? 'RESOURCE_LIMIT_EXCEEDED',
      result.reason,
      result.limitType,
      result.current,
      result.max
    );
  }
}

/**
 * Resource enforcer interface
 */
export interface ResourceEnforcer {
  /** Check if request is within limits */
  checkLimits(sessionId: string, request?: ResourceRequestInfo): ResourceCheckResult;

  /** Record resource usage after request */
  recordUsage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number
  ): void;

  /** Start tracking concurrent request */
  startRequest(sessionId: string): void;

  /** End tracking concurrent request */
  endRequest(sessionId: string): void;

  /** Get current usage for session */
  getUsage(sessionId: string): ResourceUsage;

  /** Reset usage for session */
  resetUsage(sessionId: string): void;

  /** Get all active sessions */
  getActiveSessions(): string[];
}

/**
 * Creates a resource enforcer
 */
export function createResourceEnforcer(
  config?: Partial<ResourceLimitsConfig>
): ResourceEnforcer {
  const cfg = { ...createDefaultResourceLimitsConfig(), ...config };
  const usageBySession = new Map<string, ResourceUsage>();

  function getOrCreateUsage(sessionId: string): ResourceUsage {
    let usage = usageBySession.get(sessionId);
    if (!usage) {
      usage = createResourceUsage(sessionId);
      usageBySession.set(sessionId, usage);
    }
    return usage;
  }

  return {
    checkLimits(
      sessionId: string,
      request?: ResourceRequestInfo
    ): ResourceCheckResult {
      const usage = getOrCreateUsage(sessionId);

      // Check concurrency limit
      if (request?.isConcurrent) {
        if (usage.concurrentRequests >= cfg.maxConcurrentRequests) {
          return {
            allowed: false,
            reason: `Concurrent request limit exceeded`,
            limitType: 'concurrency',
            current: usage.concurrentRequests,
            max: cfg.maxConcurrentRequests,
          };
        }
      }

      // Check tokens per request
      const estimatedRequestTokens =
        (request?.estimatedInputTokens ?? 0) +
        (request?.estimatedOutputTokens ?? 0);

      if (estimatedRequestTokens > cfg.maxTokensPerRequest) {
        return {
          allowed: false,
          reason: `Estimated tokens (${estimatedRequestTokens}) exceeds per-request limit`,
          limitType: 'tokens-per-request',
          current: estimatedRequestTokens,
          max: cfg.maxTokensPerRequest,
        };
      }

      // Check tokens per session
      const totalSessionTokens =
        usage.inputTokens + usage.outputTokens + estimatedRequestTokens;

      if (totalSessionTokens > cfg.maxTokensPerSession) {
        return {
          allowed: false,
          reason: `Session token limit would be exceeded`,
          limitType: 'tokens-per-session',
          current: usage.inputTokens + usage.outputTokens,
          max: cfg.maxTokensPerSession,
        };
      }

      // Check cost limit
      const estimatedNewCost = estimateCost(
        request?.estimatedInputTokens ?? 0,
        request?.estimatedOutputTokens ?? 0,
        cfg
      );
      const projectedCost = usage.estimatedCost + estimatedNewCost;

      if (projectedCost > cfg.maxCostPerSession) {
        return {
          allowed: false,
          reason: `Session cost limit would be exceeded`,
          limitType: 'cost',
          current: usage.estimatedCost,
          max: cfg.maxCostPerSession,
        };
      }

      // Check duration limit
      const elapsed = Date.now() - new Date(usage.startedAt).getTime();
      if (elapsed > cfg.maxDurationMs) {
        return {
          allowed: false,
          reason: `Session duration limit exceeded`,
          limitType: 'duration',
          current: elapsed,
          max: cfg.maxDurationMs,
        };
      }

      return { allowed: true };
    },

    recordUsage(
      sessionId: string,
      inputTokens: number,
      outputTokens: number,
      durationMs: number
    ): void {
      const usage = getOrCreateUsage(sessionId);

      usage.inputTokens += inputTokens;
      usage.outputTokens += outputTokens;
      usage.totalDurationMs += durationMs;
      usage.requestCount++;
      usage.estimatedCost = estimateCost(
        usage.inputTokens,
        usage.outputTokens,
        cfg
      );
      usage.lastRequestAt = new Date().toISOString();
    },

    startRequest(sessionId: string): void {
      const usage = getOrCreateUsage(sessionId);
      usage.concurrentRequests++;
    },

    endRequest(sessionId: string): void {
      const usage = usageBySession.get(sessionId);
      if (usage && usage.concurrentRequests > 0) {
        usage.concurrentRequests--;
      }
    },

    getUsage(sessionId: string): ResourceUsage {
      return getOrCreateUsage(sessionId);
    },

    resetUsage(sessionId: string): void {
      usageBySession.delete(sessionId);
    },

    getActiveSessions(): string[] {
      return Array.from(usageBySession.keys());
    },
  };
}

/**
 * Creates a strict resource enforcer that throws on limit exceeded
 */
export function createStrictResourceEnforcer(
  config?: Partial<ResourceLimitsConfig>
): ResourceEnforcer {
  const enforcer = createResourceEnforcer(config);
  const originalCheck = enforcer.checkLimits.bind(enforcer);

  enforcer.checkLimits = (
    sessionId: string,
    request?: ResourceRequestInfo
  ): ResourceCheckResult => {
    const result = originalCheck(sessionId, request);

    if (!result.allowed) {
      throw ResourceEnforcerError.fromCheckResult(result);
    }

    return result;
  };

  return enforcer;
}
