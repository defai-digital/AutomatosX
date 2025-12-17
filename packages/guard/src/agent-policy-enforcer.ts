/**
 * Agent Policy Enforcer
 *
 * Enforces agent behavior policies for controlling capabilities,
 * resource limits, and access control.
 *
 * Invariants:
 * - INV-AP-001: Policies merged by priority (higher wins)
 * - INV-AP-002: Forbidden lists take precedence over allowed
 * - INV-AP-003: Resource limits strictly enforced
 */

import {
  type AgentPolicy,
  type PolicyAction,
  type PolicyCheckResult,
  type ResourceUsage,
  type LimitCheckResult,
  AgentPolicyErrorCodes,
  createDefaultAgentPolicy,
} from '@automatosx/contracts';

/**
 * Effective policy after merging
 */
export type EffectivePolicy = AgentPolicy;

/**
 * Agent policy enforcer
 */
export interface IAgentPolicyEnforcer {
  /** Get effective policy for an agent */
  getEffectivePolicy(agentId: string, team?: string): EffectivePolicy;

  /** Check if action is allowed */
  checkAccess(
    agentId: string,
    action: PolicyAction,
    resource: string,
    team?: string
  ): PolicyCheckResult;

  /** Check resource limits */
  checkLimits(
    agentId: string,
    usage: ResourceUsage,
    team?: string
  ): LimitCheckResult;

  /** Add policy */
  addPolicy(policy: AgentPolicy): void;

  /** Remove policy */
  removePolicy(policyId: string): boolean;

  /** Get all policies */
  getPolicies(): AgentPolicy[];
}

/**
 * Creates an agent policy enforcer
 */
export function createAgentPolicyEnforcer(
  policies: AgentPolicy[] = []
): IAgentPolicyEnforcer {
  const policyStore = new Map<string, AgentPolicy>();

  // Initialize with provided policies
  for (const policy of policies) {
    policyStore.set(policy.policyId, policy);
  }

  /**
   * Match pattern with wildcards
   */
  function matchPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;

    // Simple wildcard matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(value);
  }

  /**
   * Match glob patterns for paths
   */
  function matchGlob(pattern: string, path: string): boolean {
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\*\*/g, '<<DOUBLESTAR>>')
          .replace(/\*/g, '[^/]*')
          .replace(/<<DOUBLESTAR>>/g, '.*')
          .replace(/\?/g, '.') +
        '$'
    );
    return regex.test(path);
  }

  /**
   * Check if policy matches agent
   */
  function matchesAgent(
    policy: AgentPolicy,
    agentId: string,
    team?: string
  ): boolean {
    // Match by agent ID
    if (policy.agentId !== '*' && policy.agentId !== agentId) {
      if (!matchPattern(policy.agentId, agentId)) {
        return false;
      }
    }

    // Match by team
    if (policy.team && team && policy.team !== team) {
      return false;
    }

    return true;
  }

  /**
   * Merge policies (INV-AP-001: higher priority wins)
   */
  function mergePolicies(policies: AgentPolicy[]): EffectivePolicy {
    const first = policies[0];
    if (!first) {
      return createDefaultAgentPolicy('*');
    }
    const base: EffectivePolicy = {
      policyId: first.policyId,
      agentId: first.agentId,
      team: first.team,
      canAccessMemory: first.canAccessMemory,
      canAccessSessions: first.canAccessSessions,
      allowedMemoryNamespaces: first.allowedMemoryNamespaces,
      forbiddenMemoryNamespaces: [...first.forbiddenMemoryNamespaces],
      canDelegate: first.canDelegate,
      allowedDelegates: first.allowedDelegates,
      forbiddenDelegates: [...first.forbiddenDelegates],
      maxDelegationDepth: first.maxDelegationDepth,
      maxTokensPerRequest: first.maxTokensPerRequest,
      maxRequestsPerMinute: first.maxRequestsPerMinute,
      maxConcurrentExecutions: first.maxConcurrentExecutions,
      maxSessionDurationMs: first.maxSessionDurationMs,
      allowedCapabilities: first.allowedCapabilities,
      forbiddenCapabilities: [...first.forbiddenCapabilities],
      allowedTools: first.allowedTools,
      forbiddenTools: [...first.forbiddenTools],
      allowedPaths: first.allowedPaths,
      forbiddenPaths: [...first.forbiddenPaths],
      enabled: first.enabled,
      priority: first.priority,
      description: first.description,
      tags: first.tags,
    };

    // INV-AP-002: Merge forbidden lists (union for more restrictive)
    for (const policy of policies.slice(1)) {
      base.forbiddenMemoryNamespaces = [
        ...new Set([
          ...base.forbiddenMemoryNamespaces,
          ...policy.forbiddenMemoryNamespaces,
        ]),
      ];
      base.forbiddenDelegates = [
        ...new Set([
          ...base.forbiddenDelegates,
          ...policy.forbiddenDelegates,
        ]),
      ];
      base.forbiddenTools = [
        ...new Set([...base.forbiddenTools, ...policy.forbiddenTools]),
      ];
      base.forbiddenPaths = [
        ...new Set([...base.forbiddenPaths, ...policy.forbiddenPaths]),
      ];
      base.forbiddenCapabilities = [
        ...new Set([
          ...base.forbiddenCapabilities,
          ...policy.forbiddenCapabilities,
        ]),
      ];
    }

    return base;
  }

  /**
   * Check memory access
   */
  function checkMemoryAccess(
    policy: EffectivePolicy,
    namespace: string
  ): PolicyCheckResult {
    if (!policy.canAccessMemory) {
      return {
        allowed: false,
        reason: 'Memory access disabled for agent',
        policyId: policy.policyId,
      };
    }

    // INV-AP-002: Forbidden takes precedence
    if (
      policy.forbiddenMemoryNamespaces.some((n) => matchPattern(n, namespace))
    ) {
      return {
        allowed: false,
        reason: `Namespace ${namespace} is forbidden`,
        policyId: policy.policyId,
      };
    }

    if (
      !policy.allowedMemoryNamespaces.some((n) => matchPattern(n, namespace))
    ) {
      return {
        allowed: false,
        reason: `Namespace ${namespace} is not in allowed list`,
        policyId: policy.policyId,
      };
    }

    return { allowed: true, policyId: policy.policyId };
  }

  /**
   * Check session access
   */
  function checkSessionAccess(policy: EffectivePolicy): PolicyCheckResult {
    if (!policy.canAccessSessions) {
      return {
        allowed: false,
        reason: 'Session access disabled for agent',
        policyId: policy.policyId,
      };
    }

    return { allowed: true, policyId: policy.policyId };
  }

  /**
   * Check delegation
   */
  function checkDelegation(
    policy: EffectivePolicy,
    targetAgentId: string
  ): PolicyCheckResult {
    if (!policy.canDelegate) {
      return {
        allowed: false,
        reason: 'Delegation disabled for agent',
        policyId: policy.policyId,
      };
    }

    // INV-AP-002: Forbidden takes precedence
    if (
      policy.forbiddenDelegates.some((d) => matchPattern(d, targetAgentId))
    ) {
      return {
        allowed: false,
        reason: `Cannot delegate to ${targetAgentId}`,
        policyId: policy.policyId,
      };
    }

    if (!policy.allowedDelegates.some((d) => matchPattern(d, targetAgentId))) {
      return {
        allowed: false,
        reason: `${targetAgentId} is not in allowed delegates`,
        policyId: policy.policyId,
      };
    }

    return { allowed: true, policyId: policy.policyId };
  }

  /**
   * Check tool access
   */
  function checkToolAccess(
    policy: EffectivePolicy,
    toolName: string
  ): PolicyCheckResult {
    // INV-AP-002: Forbidden takes precedence
    if (policy.forbiddenTools.some((t) => matchPattern(t, toolName))) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is forbidden`,
        policyId: policy.policyId,
      };
    }

    if (!policy.allowedTools.some((t) => matchPattern(t, toolName))) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is not allowed`,
        policyId: policy.policyId,
      };
    }

    return { allowed: true, policyId: policy.policyId };
  }

  /**
   * Check path access
   */
  function checkPathAccess(
    policy: EffectivePolicy,
    path: string
  ): PolicyCheckResult {
    // INV-AP-002: Forbidden takes precedence
    if (policy.forbiddenPaths.some((p) => matchGlob(p, path))) {
      return {
        allowed: false,
        reason: `Path ${path} is forbidden`,
        policyId: policy.policyId,
      };
    }

    if (!policy.allowedPaths.some((p) => matchGlob(p, path))) {
      return {
        allowed: false,
        reason: `Path ${path} is not allowed`,
        policyId: policy.policyId,
      };
    }

    return { allowed: true, policyId: policy.policyId };
  }

  /**
   * Check capability
   */
  function checkCapability(
    policy: EffectivePolicy,
    capability: string
  ): PolicyCheckResult {
    // INV-AP-002: Forbidden takes precedence
    if (
      policy.forbiddenCapabilities.some((c) => matchPattern(c, capability))
    ) {
      return {
        allowed: false,
        reason: `Capability ${capability} is forbidden`,
        policyId: policy.policyId,
      };
    }

    if (
      !policy.allowedCapabilities.some((c) => matchPattern(c, capability))
    ) {
      return {
        allowed: false,
        reason: `Capability ${capability} is not allowed`,
        policyId: policy.policyId,
      };
    }

    return { allowed: true, policyId: policy.policyId };
  }

  return {
    getEffectivePolicy(agentId: string, team?: string): EffectivePolicy {
      const allPolicies = Array.from(policyStore.values());

      const matching = allPolicies
        .filter((p) => p.enabled)
        .filter((p) => matchesAgent(p, agentId, team))
        .sort((a, b) => b.priority - a.priority);

      return mergePolicies(matching);
    },

    checkAccess(
      agentId: string,
      action: PolicyAction,
      resource: string,
      team?: string
    ): PolicyCheckResult {
      const policy = this.getEffectivePolicy(agentId, team);

      switch (action) {
        case 'accessMemory':
          return checkMemoryAccess(policy, resource);
        case 'accessSession':
          return checkSessionAccess(policy);
        case 'delegate':
          return checkDelegation(policy, resource);
        case 'useTool':
          return checkToolAccess(policy, resource);
        case 'accessPath':
          return checkPathAccess(policy, resource);
        case 'useCapability':
          return checkCapability(policy, resource);
        default:
          return {
            allowed: false,
            reason: 'Unknown action type',
            policyId: policy.policyId,
          };
      }
    },

    // INV-AP-003: Resource limits strictly enforced
    checkLimits(
      agentId: string,
      usage: ResourceUsage,
      team?: string
    ): LimitCheckResult {
      const policy = this.getEffectivePolicy(agentId, team);
      const violations: string[] = [];

      if (usage.tokensThisRequest > policy.maxTokensPerRequest) {
        violations.push(
          `Token limit exceeded: ${usage.tokensThisRequest} > ${policy.maxTokensPerRequest}`
        );
      }

      if (usage.requestsThisMinute > policy.maxRequestsPerMinute) {
        violations.push(
          `Request rate exceeded: ${usage.requestsThisMinute} > ${policy.maxRequestsPerMinute}`
        );
      }

      if (usage.concurrentExecutions > policy.maxConcurrentExecutions) {
        violations.push(
          `Concurrent execution limit exceeded: ${usage.concurrentExecutions} > ${policy.maxConcurrentExecutions}`
        );
      }

      if (
        usage.sessionDurationMs !== undefined &&
        usage.sessionDurationMs > policy.maxSessionDurationMs
      ) {
        violations.push(
          `Session duration exceeded: ${usage.sessionDurationMs}ms > ${policy.maxSessionDurationMs}ms`
        );
      }

      return {
        withinLimits: violations.length === 0,
        violations,
        limits: {
          maxTokensPerRequest: policy.maxTokensPerRequest,
          maxRequestsPerMinute: policy.maxRequestsPerMinute,
          maxConcurrentExecutions: policy.maxConcurrentExecutions,
          maxSessionDurationMs: policy.maxSessionDurationMs,
        },
      };
    },

    addPolicy(policy: AgentPolicy): void {
      policyStore.set(policy.policyId, policy);
    },

    removePolicy(policyId: string): boolean {
      return policyStore.delete(policyId);
    },

    getPolicies(): AgentPolicy[] {
      return Array.from(policyStore.values());
    },
  };
}

/**
 * Agent policy error
 */
export class AgentPolicyError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `Agent policy error: ${code}`);
    this.name = 'AgentPolicyError';
  }

  static accessDenied(action: string, resource: string): AgentPolicyError {
    return new AgentPolicyError(
      AgentPolicyErrorCodes.ACCESS_DENIED,
      `Access denied for ${action} on ${resource}`
    );
  }

  static limitExceeded(limit: string, value: number, max: number): AgentPolicyError {
    return new AgentPolicyError(
      AgentPolicyErrorCodes.LIMIT_EXCEEDED,
      `${limit} exceeded: ${value} > ${max}`
    );
  }

  static delegationDenied(targetAgent: string): AgentPolicyError {
    return new AgentPolicyError(
      AgentPolicyErrorCodes.DELEGATION_DENIED,
      `Delegation to ${targetAgent} not allowed`
    );
  }

  static toolDenied(tool: string): AgentPolicyError {
    return new AgentPolicyError(
      AgentPolicyErrorCodes.TOOL_DENIED,
      `Tool ${tool} not allowed`
    );
  }

  static pathDenied(path: string): AgentPolicyError {
    return new AgentPolicyError(
      AgentPolicyErrorCodes.PATH_DENIED,
      `Path ${path} not allowed`
    );
  }
}
