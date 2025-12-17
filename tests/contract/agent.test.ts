/**
 * Agent Contract Invariant Tests
 *
 * Tests for agent invariants documented in packages/contracts/src/agent/v1/invariants.md
 *
 * Invariants tested:
 * - INV-AGT-001: Agent ID Validation
 * - INV-AGT-002: Registration Idempotence
 * - INV-AGT-003: Enabled Filtering
 * - INV-AGT-004: Team Filtering
 * - INV-AGT-005: Capability Matching
 * - INV-AGT-006: Workflow Validation
 */

import { describe, it, expect } from 'vitest';
import {
  AgentProfileSchema,
  AgentRunOptionsSchema,
  AgentResultSchema,
  AgentWorkflowStepSchema,
  validateAgentProfile,
  safeValidateAgentProfile,
  AgentErrorCode,
} from '@automatosx/contracts';

describe('Agent Contract', () => {
  describe('AgentProfileSchema', () => {
    it('should validate a minimal agent profile', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'A test agent',
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should validate a full agent profile', () => {
      const profile = {
        agentId: 'code-reviewer',
        displayName: 'Code Reviewer Agent',
        version: '1.0.0',
        description: 'Reviews code for quality and best practices',
        role: 'Code Quality Analyst',
        expertise: ['TypeScript', 'React', 'Node.js'],
        capabilities: ['code-review', 'lint', 'suggest-fixes'],
        systemPrompt: 'You are an expert code reviewer...',
        personality: {
          traits: ['thorough', 'helpful'],
          communicationStyle: 'professional',
        },
        orchestration: {
          maxDelegationDepth: 3,
          canReadWorkspaces: ['src', 'tests'],
          canWriteToShared: false,
        },
        team: 'quality',
        tags: ['code', 'review'],
        priority: 80,
        enabled: true,
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should reject invalid agent ID', () => {
      const profile = {
        agentId: '123-invalid', // Must start with letter
        description: 'Invalid agent',
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const profile = {
        agentId: 'test-agent',
        description: '', // Empty not allowed
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should reject invalid version format', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent',
        version: 'v1.0', // Must be SemVer
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should enforce temperature bounds', () => {
      const validProfile = {
        agentId: 'test-agent',
        description: 'Test agent',
        temperature: 1.5,
      };

      const result = AgentProfileSchema.safeParse(validProfile);
      expect(result.success).toBe(true);

      const invalidProfile = {
        agentId: 'test-agent',
        description: 'Test agent',
        temperature: 3.0, // Max is 2
      };

      const invalidResult = AgentProfileSchema.safeParse(invalidProfile);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('AgentWorkflowStepSchema', () => {
    it('should validate a prompt step', () => {
      const step = {
        stepId: 'analyze',
        name: 'Analyze Code',
        type: 'prompt',
        config: { model: 'default' },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate a delegate step', () => {
      const step = {
        stepId: 'delegate-review',
        name: 'Delegate to Reviewer',
        type: 'delegate',
        config: { targetAgent: 'code-reviewer' },
        timeoutMs: 60000,
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate step with retry policy', () => {
      const step = {
        stepId: 'api-call',
        name: 'Call API',
        type: 'tool',
        config: { tool: 'http-request' },
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
          backoffMultiplier: 2,
          retryOn: ['timeout', 'serverError'],
        },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate step with dependencies', () => {
      const step = {
        stepId: 'summarize',
        name: 'Summarize Results',
        type: 'prompt',
        config: {},
        dependencies: ['analyze', 'review'],
        keyQuestions: ['What are the main findings?'],
        outputs: ['summary'],
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('AgentRunOptionsSchema', () => {
    it('should validate empty options', () => {
      const result = AgentRunOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate full options', () => {
      const options = {
        memory: true,
        saveMemory: true,
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        createSession: false,
        provider: 'claude',
        model: 'default',
        format: 'json',
        verbose: true,
        streaming: true,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440001',
      };

      const result = AgentRunOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const options = {
        sessionId: 'not-a-uuid',
      };

      const result = AgentRunOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });
  });

  describe('AgentResultSchema', () => {
    it('should validate successful result', () => {
      const result = {
        success: true,
        agentId: 'test-agent',
        output: { summary: 'Task completed' },
        totalDurationMs: 1500,
      };

      const validation = AgentResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should validate failed result', () => {
      const result = {
        success: false,
        agentId: 'test-agent',
        error: {
          code: AgentErrorCode.AGENT_STAGE_FAILED,
          message: 'Step execution failed',
          stepId: 'analyze',
        },
        totalDurationMs: 500,
      };

      const validation = AgentResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('validateAgentProfile should throw on invalid input', () => {
      expect(() =>
        validateAgentProfile({ agentId: '' })
      ).toThrow();
    });

    it('safeValidateAgentProfile should return error on invalid input', () => {
      const result = safeValidateAgentProfile({ agentId: '' });
      expect(result.success).toBe(false);
    });

    it('safeValidateAgentProfile should return data on valid input', () => {
      const result = safeValidateAgentProfile({
        agentId: 'test-agent',
        description: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agentId).toBe('test-agent');
      }
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      expect(AgentErrorCode.AGENT_NOT_FOUND).toBe('AGENT_NOT_FOUND');
      expect(AgentErrorCode.AGENT_VALIDATION_ERROR).toBe('AGENT_VALIDATION_ERROR');
      expect(AgentErrorCode.AGENT_DELEGATION_DEPTH_EXCEEDED).toBe(
        'AGENT_DELEGATION_DEPTH_EXCEEDED'
      );
      expect(AgentErrorCode.AGENT_STAGE_FAILED).toBe('AGENT_STAGE_FAILED');
    });
  });
});

// ============================================================================
// Agent Registry Invariant Tests
// ============================================================================

describe('INV-AGT: Agent Registry Invariants', () => {
  describe('INV-AGT-001: Agent ID Validation', () => {
    it('should accept valid agent IDs', () => {
      const validIds = [
        'code-reviewer',
        'test-agent',
        'a',
        'agent-123',
        'my-agent-v2',
      ];

      for (const agentId of validIds) {
        const profile = { agentId, description: 'Test' };
        const result = AgentProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
      }
    });

    it('should reject agent IDs starting with number', () => {
      const profile = {
        agentId: '123-agent',
        description: 'Invalid',
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should accept agent IDs with uppercase letters', () => {
      // Schema regex allows uppercase: /^[a-zA-Z][a-zA-Z0-9_-]*$/
      const profile = {
        agentId: 'CodeReviewer',
        description: 'Valid with uppercase',
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should reject agent IDs with invalid special characters', () => {
      // Only alphanumeric, dash, underscore allowed
      const invalidIds = ['agent.test', 'agent@test', 'agent/test'];

      for (const agentId of invalidIds) {
        const profile = { agentId, description: 'Test' };
        const result = AgentProfileSchema.safeParse(profile);
        expect(result.success).toBe(false);
      }
    });

    it('should accept agent IDs with underscores and dashes', () => {
      // Underscore and dash are valid per regex
      const validIds = ['agent_test', 'agent-test', 'My_Agent-123'];

      for (const agentId of validIds) {
        const profile = { agentId, description: 'Test' };
        const result = AgentProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
      }
    });

    it('should enforce max agent ID length', () => {
      const profile = {
        agentId: 'a'.repeat(101), // Exceeds 100 char limit
        description: 'Too long ID',
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });

  describe('INV-AGT-002: Registration Idempotence', () => {
    it('should validate same agent profile multiple times', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent',
        enabled: true,
      };

      // Multiple validations should produce identical results
      const result1 = AgentProfileSchema.parse(profile);
      const result2 = AgentProfileSchema.parse(profile);
      const result3 = AgentProfileSchema.parse(profile);

      expect(result1.agentId).toBe(result2.agentId);
      expect(result2.agentId).toBe(result3.agentId);
      expect(result1.enabled).toBe(result2.enabled);
    });

    it('should preserve all fields on re-registration', () => {
      const fullProfile = {
        agentId: 'full-agent',
        displayName: 'Full Agent',
        description: 'Complete profile',
        team: 'engineering',
        capabilities: ['review', 'test'],
        tags: ['important'],
        priority: 75,
        enabled: true,
      };

      const parsed = AgentProfileSchema.parse(fullProfile);

      // Simulate re-registration with same ID
      const reRegistered = AgentProfileSchema.parse(fullProfile);

      expect(reRegistered.displayName).toBe(parsed.displayName);
      expect(reRegistered.team).toBe(parsed.team);
      expect(reRegistered.capabilities).toEqual(parsed.capabilities);
    });
  });

  describe('INV-AGT-003: Enabled Filtering', () => {
    it('should default enabled to true', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test',
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.enabled).toBe(true);
    });

    it('should support explicit enabled=false', () => {
      const profile = {
        agentId: 'disabled-agent',
        description: 'Disabled',
        enabled: false,
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.enabled).toBe(false);
    });

    it('should filter disabled agents from active list', () => {
      const agents = [
        { agentId: 'enabled-1', description: 'E1', enabled: true },
        { agentId: 'disabled-1', description: 'D1', enabled: false },
        { agentId: 'enabled-2', description: 'E2', enabled: true },
        { agentId: 'disabled-2', description: 'D2', enabled: false },
      ].map((a) => AgentProfileSchema.parse(a));

      const enabledAgents = agents.filter((a) => a.enabled);
      expect(enabledAgents).toHaveLength(2);
      expect(enabledAgents.map((a) => a.agentId)).toContain('enabled-1');
      expect(enabledAgents.map((a) => a.agentId)).toContain('enabled-2');
    });
  });

  describe('INV-AGT-004: Team Filtering', () => {
    it('should support team assignment', () => {
      const profile = {
        agentId: 'team-agent',
        description: 'Team member',
        team: 'engineering',
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.team).toBe('engineering');
    });

    it('should filter agents by team', () => {
      const agents = [
        { agentId: 'eng-1', description: 'E1', team: 'engineering' },
        { agentId: 'qa-1', description: 'Q1', team: 'quality' },
        { agentId: 'eng-2', description: 'E2', team: 'engineering' },
        { agentId: 'ops-1', description: 'O1', team: 'operations' },
      ].map((a) => AgentProfileSchema.parse(a));

      const engineeringTeam = agents.filter((a) => a.team === 'engineering');
      expect(engineeringTeam).toHaveLength(2);

      const qualityTeam = agents.filter((a) => a.team === 'quality');
      expect(qualityTeam).toHaveLength(1);
    });

    it('should allow agents without team', () => {
      const profile = {
        agentId: 'no-team',
        description: 'No team assigned',
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.team).toBeUndefined();
    });
  });

  describe('INV-AGT-005: Capability Matching', () => {
    it('should support capabilities array', () => {
      const profile = {
        agentId: 'capable-agent',
        description: 'Agent with capabilities',
        capabilities: ['code-review', 'testing', 'documentation'],
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.capabilities).toHaveLength(3);
      expect(result.capabilities).toContain('code-review');
    });

    it('should filter agents by required capability', () => {
      const agents = [
        { agentId: 'agent-1', description: 'A1', capabilities: ['review', 'test'] },
        { agentId: 'agent-2', description: 'A2', capabilities: ['deploy', 'monitor'] },
        { agentId: 'agent-3', description: 'A3', capabilities: ['review', 'deploy'] },
      ].map((a) => AgentProfileSchema.parse(a));

      const reviewCapable = agents.filter(
        (a) => a.capabilities?.includes('review')
      );
      expect(reviewCapable).toHaveLength(2);
      expect(reviewCapable.map((a) => a.agentId)).toContain('agent-1');
      expect(reviewCapable.map((a) => a.agentId)).toContain('agent-3');
    });

    it('should match agents with multiple required capabilities', () => {
      const agents = [
        { agentId: 'full', description: 'Full', capabilities: ['a', 'b', 'c'] },
        { agentId: 'partial', description: 'Partial', capabilities: ['a', 'b'] },
        { agentId: 'minimal', description: 'Min', capabilities: ['a'] },
      ].map((a) => AgentProfileSchema.parse(a));

      const requiredCaps = ['a', 'b'];
      const matching = agents.filter((a) =>
        requiredCaps.every((cap) => a.capabilities?.includes(cap))
      );

      expect(matching).toHaveLength(2);
      expect(matching.map((a) => a.agentId)).toContain('full');
      expect(matching.map((a) => a.agentId)).toContain('partial');
    });
  });

  describe('INV-AGT-006: Workflow Validation', () => {
    it('should validate workflow steps array', () => {
      const profile = {
        agentId: 'workflow-agent',
        description: 'Agent with workflow',
        workflow: [
          // Prompt steps require non-empty prompt in config per INV-AGT-WF-001
          { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: { prompt: 'Do something' } },
          { stepId: 'step-2', name: 'Step 2', type: 'tool', config: {} },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workflow).toHaveLength(2);
      }
    });

    it('should validate step types', () => {
      const validTypes = ['prompt', 'tool', 'conditional', 'loop', 'parallel', 'delegate'];

      for (const type of validTypes) {
        const step = {
          stepId: `step-${type}`,
          name: `${type} step`,
          type,
          config: {},
        };
        const result = AgentWorkflowStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid step type', () => {
      const step = {
        stepId: 'invalid-step',
        name: 'Invalid',
        type: 'unknown-type',
        config: {},
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should validate step dependencies', () => {
      const step = {
        stepId: 'dependent-step',
        name: 'Dependent Step',
        type: 'prompt',
        config: {},
        dependencies: ['step-1', 'step-2'],
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dependencies).toContain('step-1');
      }
    });

    it('should validate step retry policy', () => {
      const step = {
        stepId: 'retry-step',
        name: 'Retry Step',
        type: 'tool',
        config: {},
        retryPolicy: {
          maxAttempts: 5,
          backoffMs: 1000,
          backoffMultiplier: 2,
          retryOn: ['timeout'],
        },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.retryPolicy?.maxAttempts).toBe(5);
      }
    });

    it('should validate step timeout', () => {
      const step = {
        stepId: 'timeout-step',
        name: 'Timeout Step',
        type: 'delegate',
        config: { targetAgent: 'other-agent' },
        timeoutMs: 30000,
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(30000);
      }
    });
  });
});

// ============================================================================
// Agent Execution Invariant Tests
// ============================================================================

describe('Agent Execution Invariants', () => {
  describe('Run Options', () => {
    it('should support all format options', () => {
      // Schema only supports 'text' and 'json' formats
      const formats = ['text', 'json'];

      for (const format of formats) {
        const options = { format };
        const result = AgentRunOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      }
    });

    it('should reject unsupported format options', () => {
      const invalidFormats = ['yaml', 'xml', 'csv'];

      for (const format of invalidFormats) {
        const options = { format };
        const result = AgentRunOptionsSchema.safeParse(options);
        expect(result.success).toBe(false);
      }
    });

    it('should validate sessionId as UUID', () => {
      const validOptions = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      };
      expect(AgentRunOptionsSchema.safeParse(validOptions).success).toBe(true);

      const invalidOptions = {
        sessionId: 'not-a-uuid',
      };
      expect(AgentRunOptionsSchema.safeParse(invalidOptions).success).toBe(false);
    });

    it('should validate idempotencyKey as UUID', () => {
      const options = {
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = AgentRunOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Result Schema', () => {
    it('should validate success result with output', () => {
      const result = {
        success: true,
        agentId: 'test-agent',
        output: { data: 'result' },
        totalDurationMs: 1000,
      };

      const validation = AgentResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should validate failure result with error', () => {
      const result = {
        success: false,
        agentId: 'test-agent',
        error: {
          code: AgentErrorCode.AGENT_STAGE_FAILED,
          message: 'Execution failed',
        },
        totalDurationMs: 500,
      };

      const validation = AgentResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should track totalDurationMs', () => {
      const result = {
        success: true,
        agentId: 'test-agent',
        output: {},
        totalDurationMs: 2500,
      };

      const validation = AgentResultSchema.parse(result);
      expect(validation.totalDurationMs).toBe(2500);
    });
  });
});

// ============================================================================
// Agent Orchestration Invariant Tests
// ============================================================================

describe('Agent Orchestration Invariants', () => {
  describe('Delegation Depth', () => {
    it('should support maxDelegationDepth configuration', () => {
      const profile = {
        agentId: 'delegating-agent',
        description: 'Can delegate',
        orchestration: {
          maxDelegationDepth: 3,
        },
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.orchestration?.maxDelegationDepth).toBe(3);
    });

    it('should have delegation depth error code', () => {
      expect(AgentErrorCode.AGENT_DELEGATION_DEPTH_EXCEEDED).toBeDefined();
    });
  });

  describe('Workspace Access', () => {
    it('should support canReadWorkspaces configuration', () => {
      const profile = {
        agentId: 'workspace-agent',
        description: 'Limited workspace access',
        orchestration: {
          canReadWorkspaces: ['src', 'tests', 'docs'],
        },
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.orchestration?.canReadWorkspaces).toContain('src');
    });

    it('should support canWriteToShared configuration', () => {
      const profile = {
        agentId: 'shared-writer',
        description: 'Can write to shared',
        orchestration: {
          canWriteToShared: true,
        },
      };

      const result = AgentProfileSchema.parse(profile);
      expect(result.orchestration?.canWriteToShared).toBe(true);
    });
  });
});
