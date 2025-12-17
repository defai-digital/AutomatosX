import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentPolicyEnforcer,
  AgentPolicyError,
  type IAgentPolicyEnforcer,
} from '@automatosx/guard';
import {
  type AgentPolicy,
  createDefaultAgentPolicy,
  createRestrictiveAgentPolicy,
  AgentPolicyErrorCodes,
} from '@automatosx/contracts';

describe('Agent Governance', () => {
  // ============================================================================
  // Agent Policy Enforcer Tests
  // ============================================================================
  describe('Agent Policy Enforcer (INV-AP-001, INV-AP-002, INV-AP-003)', () => {
    let enforcer: IAgentPolicyEnforcer;

    beforeEach(() => {
      enforcer = createAgentPolicyEnforcer();
    });

    describe('Policy Management', () => {
      it('should add and retrieve policies', () => {
        const policy = createDefaultAgentPolicy('agent-1');
        policy.policyId = 'policy-1';
        enforcer.addPolicy(policy);

        const policies = enforcer.getPolicies();
        expect(policies).toHaveLength(1);
        expect(policies[0]!.policyId).toBe('policy-1');
      });

      it('should remove policies', () => {
        const policy = createDefaultAgentPolicy('agent-1');
        policy.policyId = 'policy-to-remove';
        enforcer.addPolicy(policy);

        const removed = enforcer.removePolicy('policy-to-remove');
        expect(removed).toBe(true);
        expect(enforcer.getPolicies()).toHaveLength(0);
      });

      it('should return false when removing non-existent policy', () => {
        const removed = enforcer.removePolicy('non-existent');
        expect(removed).toBe(false);
      });
    });

    describe('INV-AP-001: Policy Priority Merging', () => {
      it('should merge policies with higher priority winning', () => {
        const lowPriority: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'low',
          priority: 10,
          maxTokensPerRequest: 50000,
        };

        const highPriority: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'high',
          priority: 90,
          maxTokensPerRequest: 100000,
        };

        enforcer.addPolicy(lowPriority);
        enforcer.addPolicy(highPriority);

        const effective = enforcer.getEffectivePolicy('any-agent');
        expect(effective.maxTokensPerRequest).toBe(100000); // High priority wins
      });

      it('should match specific agent over wildcard with higher priority', () => {
        const wildcardPolicy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'wildcard',
          priority: 50,
          maxTokensPerRequest: 50000,
        };

        const specificPolicy: AgentPolicy = {
          ...createDefaultAgentPolicy('specific-agent'),
          policyId: 'specific',
          priority: 60, // Higher priority wins
          maxTokensPerRequest: 100000,
        };

        enforcer.addPolicy(wildcardPolicy);
        enforcer.addPolicy(specificPolicy);

        const effective = enforcer.getEffectivePolicy('specific-agent');
        expect(effective.policyId).toBe('specific');
      });

      it('should match by team', () => {
        const teamPolicy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'team-policy',
          team: 'engineering',
          priority: 50,
          maxRequestsPerMinute: 100,
        };

        enforcer.addPolicy(teamPolicy);

        const effective = enforcer.getEffectivePolicy('any-agent', 'engineering');
        expect(effective.maxRequestsPerMinute).toBe(100);
      });

      it('should return default policy when no matches', () => {
        const effective = enforcer.getEffectivePolicy('unmatched-agent');
        expect(effective.policyId).toBe('default');
        expect(effective.canAccessMemory).toBe(true);
      });
    });

    describe('INV-AP-002: Forbidden Takes Precedence', () => {
      it('should deny memory access when namespace is forbidden', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'memory-policy',
          priority: 50,
          allowedMemoryNamespaces: ['*'],
          forbiddenMemoryNamespaces: ['secret-*', 'private'],
        };

        enforcer.addPolicy(policy);

        // Should allow general access
        const allowed = enforcer.checkAccess('agent-1', 'accessMemory', 'public');
        expect(allowed.allowed).toBe(true);

        // Should deny forbidden namespace
        const denied = enforcer.checkAccess('agent-1', 'accessMemory', 'secret-keys');
        expect(denied.allowed).toBe(false);
        expect(denied.reason).toContain('forbidden');
      });

      it('should deny tool access when tool is forbidden', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'tool-policy',
          priority: 50,
          allowedTools: ['*'],
          forbiddenTools: ['dangerous-tool', 'rm-*'],
        };

        enforcer.addPolicy(policy);

        const allowed = enforcer.checkAccess('agent-1', 'useTool', 'safe-tool');
        expect(allowed.allowed).toBe(true);

        const denied = enforcer.checkAccess('agent-1', 'useTool', 'dangerous-tool');
        expect(denied.allowed).toBe(false);
      });

      it('should deny path access when path is forbidden', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'path-policy',
          priority: 50,
          allowedPaths: ['**'],
          forbiddenPaths: ['/etc/**', '/root/**', '**/.env'],
        };

        enforcer.addPolicy(policy);

        const allowed = enforcer.checkAccess('agent-1', 'accessPath', '/home/user/file.txt');
        expect(allowed.allowed).toBe(true);

        const deniedEtc = enforcer.checkAccess('agent-1', 'accessPath', '/etc/passwd');
        expect(deniedEtc.allowed).toBe(false);

        const deniedEnv = enforcer.checkAccess('agent-1', 'accessPath', '/app/.env');
        expect(deniedEnv.allowed).toBe(false);
      });

      it('should deny delegation when target is forbidden', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'delegation-policy',
          priority: 50,
          canDelegate: true,
          allowedDelegates: ['*'],
          forbiddenDelegates: ['untrusted-*', 'external-agent'],
        };

        enforcer.addPolicy(policy);

        const allowed = enforcer.checkAccess('agent-1', 'delegate', 'trusted-agent');
        expect(allowed.allowed).toBe(true);

        const denied = enforcer.checkAccess('agent-1', 'delegate', 'untrusted-agent');
        expect(denied.allowed).toBe(false);
      });

      it('should deny capability when forbidden', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'capability-policy',
          priority: 50,
          allowedCapabilities: ['*'],
          forbiddenCapabilities: ['code-execution', 'network-access'],
        };

        enforcer.addPolicy(policy);

        const allowed = enforcer.checkAccess('agent-1', 'useCapability', 'file-read');
        expect(allowed.allowed).toBe(true);

        const denied = enforcer.checkAccess('agent-1', 'useCapability', 'code-execution');
        expect(denied.allowed).toBe(false);
      });

      it('should merge forbidden lists from multiple policies', () => {
        const policy1: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'policy1',
          priority: 50,
          forbiddenTools: ['tool-a'],
        };

        const policy2: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'policy2',
          priority: 40,
          forbiddenTools: ['tool-b'],
        };

        enforcer.addPolicy(policy1);
        enforcer.addPolicy(policy2);

        // Both should be forbidden after merging
        const deniedA = enforcer.checkAccess('agent-1', 'useTool', 'tool-a');
        const deniedB = enforcer.checkAccess('agent-1', 'useTool', 'tool-b');

        expect(deniedA.allowed).toBe(false);
        expect(deniedB.allowed).toBe(false);
      });
    });

    describe('INV-AP-003: Resource Limits Enforcement', () => {
      it('should enforce token limit', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'limit-policy',
          priority: 50,
          maxTokensPerRequest: 10000,
        };

        enforcer.addPolicy(policy);

        const withinLimit = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 5000,
          requestsThisMinute: 10,
          concurrentExecutions: 1,
        });
        expect(withinLimit.withinLimits).toBe(true);

        const exceeded = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 15000,
          requestsThisMinute: 10,
          concurrentExecutions: 1,
        });
        expect(exceeded.withinLimits).toBe(false);
        expect(exceeded.violations.length).toBeGreaterThan(0);
        expect(exceeded.violations.some(v => v.toLowerCase().includes('token'))).toBe(true);
      });

      it('should enforce request rate limit', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'rate-policy',
          priority: 50,
          maxRequestsPerMinute: 30,
        };

        enforcer.addPolicy(policy);

        const exceeded = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 1000,
          requestsThisMinute: 50,
          concurrentExecutions: 1,
        });

        expect(exceeded.withinLimits).toBe(false);
        expect(exceeded.violations.length).toBeGreaterThan(0);
        expect(exceeded.violations.some(v => v.toLowerCase().includes('request'))).toBe(true);
      });

      it('should enforce concurrent execution limit', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'concurrent-policy',
          priority: 50,
          maxConcurrentExecutions: 2,
        };

        enforcer.addPolicy(policy);

        const exceeded = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 1000,
          requestsThisMinute: 10,
          concurrentExecutions: 5,
        });

        expect(exceeded.withinLimits).toBe(false);
        expect(exceeded.violations.length).toBeGreaterThan(0);
        expect(exceeded.violations.some(v => v.toLowerCase().includes('concurrent'))).toBe(true);
      });

      it('should enforce session duration limit', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'session-policy',
          priority: 50,
          maxSessionDurationMs: 3600000, // 1 hour
        };

        enforcer.addPolicy(policy);

        const exceeded = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 1000,
          requestsThisMinute: 10,
          concurrentExecutions: 1,
          sessionDurationMs: 7200000, // 2 hours
        });

        expect(exceeded.withinLimits).toBe(false);
        expect(exceeded.violations.length).toBeGreaterThan(0);
        expect(exceeded.violations.some(v => v.toLowerCase().includes('session'))).toBe(true);
      });

      it('should return all limits in check result', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'limits-info',
          priority: 50,
          maxTokensPerRequest: 50000,
          maxRequestsPerMinute: 60,
          maxConcurrentExecutions: 3,
          maxSessionDurationMs: 3600000,
        };

        enforcer.addPolicy(policy);

        const result = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 1000,
          requestsThisMinute: 10,
          concurrentExecutions: 1,
        });

        expect(result.limits.maxTokensPerRequest).toBe(50000);
        expect(result.limits.maxRequestsPerMinute).toBe(60);
        expect(result.limits.maxConcurrentExecutions).toBe(3);
        expect(result.limits.maxSessionDurationMs).toBe(3600000);
      });

      it('should report multiple violations', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'multi-violation',
          priority: 50,
          maxTokensPerRequest: 1000,
          maxRequestsPerMinute: 10,
          maxConcurrentExecutions: 1,
        };

        enforcer.addPolicy(policy);

        const result = enforcer.checkLimits('agent-1', {
          tokensThisRequest: 5000,
          requestsThisMinute: 50,
          concurrentExecutions: 5,
        });

        expect(result.withinLimits).toBe(false);
        expect(result.violations).toHaveLength(3);
      });
    });

    describe('Access Control Features', () => {
      it('should deny memory access when disabled', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'no-memory',
          priority: 50,
          canAccessMemory: false,
        };

        enforcer.addPolicy(policy);

        const result = enforcer.checkAccess('agent-1', 'accessMemory', 'any-namespace');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('disabled');
      });

      it('should deny session access when disabled', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'no-sessions',
          priority: 50,
          canAccessSessions: false,
        };

        enforcer.addPolicy(policy);

        const result = enforcer.checkAccess('agent-1', 'accessSession', 'any');
        expect(result.allowed).toBe(false);
      });

      it('should deny delegation when disabled', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'no-delegation',
          priority: 50,
          canDelegate: false,
        };

        enforcer.addPolicy(policy);

        const result = enforcer.checkAccess('agent-1', 'delegate', 'other-agent');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('disabled');
      });

      it('should support pattern matching for agents', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('frontend-*'),
          policyId: 'frontend-policy',
          priority: 50,
          maxTokensPerRequest: 25000,
        };

        enforcer.addPolicy(policy);

        const matchedEffective = enforcer.getEffectivePolicy('frontend-agent');
        expect(matchedEffective.maxTokensPerRequest).toBe(25000);

        const unmatchedEffective = enforcer.getEffectivePolicy('backend-agent');
        expect(unmatchedEffective.maxTokensPerRequest).not.toBe(25000);
      });

      it('should check allowed list when not using wildcard', () => {
        const policy: AgentPolicy = {
          ...createDefaultAgentPolicy('*'),
          policyId: 'restricted-tools',
          priority: 50,
          allowedTools: ['read-file', 'write-file'], // Explicit list, not '*'
          forbiddenTools: [],
        };

        enforcer.addPolicy(policy);

        const allowed = enforcer.checkAccess('agent-1', 'useTool', 'read-file');
        expect(allowed.allowed).toBe(true);

        const notAllowed = enforcer.checkAccess('agent-1', 'useTool', 'execute-command');
        expect(notAllowed.allowed).toBe(false);
        expect(notAllowed.reason).toContain('not allowed');
      });
    });

    describe('Restrictive Policy', () => {
      it('should create fully restrictive policy', () => {
        const restrictive = createRestrictiveAgentPolicy('lockdown', 'restricted-agent');
        enforcer.addPolicy(restrictive);

        const effective = enforcer.getEffectivePolicy('restricted-agent');

        expect(effective.canAccessMemory).toBe(false);
        expect(effective.canAccessSessions).toBe(false);
        expect(effective.canDelegate).toBe(false);
        expect(effective.maxDelegationDepth).toBe(0);
        expect(effective.forbiddenTools).toContain('*');
        expect(effective.forbiddenPaths).toContain('**');
      });
    });

    describe('Error Handling', () => {
      it('should create access denied error', () => {
        const error = AgentPolicyError.accessDenied('useTool', 'dangerous-tool');
        expect(error.code).toBe(AgentPolicyErrorCodes.ACCESS_DENIED);
        expect(error.message).toContain('useTool');
        expect(error.message).toContain('dangerous-tool');
      });

      it('should create limit exceeded error', () => {
        const error = AgentPolicyError.limitExceeded('tokens', 50000, 10000);
        expect(error.code).toBe(AgentPolicyErrorCodes.LIMIT_EXCEEDED);
        expect(error.message).toContain('50000');
        expect(error.message).toContain('10000');
      });

      it('should create delegation denied error', () => {
        const error = AgentPolicyError.delegationDenied('untrusted-agent');
        expect(error.code).toBe(AgentPolicyErrorCodes.DELEGATION_DENIED);
        expect(error.message).toContain('untrusted-agent');
      });

      it('should create tool denied error', () => {
        const error = AgentPolicyError.toolDenied('rm');
        expect(error.code).toBe(AgentPolicyErrorCodes.TOOL_DENIED);
        expect(error.message).toContain('rm');
      });

      it('should create path denied error', () => {
        const error = AgentPolicyError.pathDenied('/etc/passwd');
        expect(error.code).toBe(AgentPolicyErrorCodes.PATH_DENIED);
        expect(error.message).toContain('/etc/passwd');
      });
    });
  });
});
