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
  // Agent Selection Schemas (INV-AGT-SEL)
  AgentRecommendRequestSchema,
  AgentRecommendResultSchema,
  AgentMatchSchema,
  AgentCapabilitiesRequestSchema,
  AgentCapabilitiesResultSchema,
} from '@defai.digital/contracts';

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

// ============================================================================
// Agent Selection Invariant Tests (INV-AGT-SEL-001 to INV-AGT-SEL-006)
// ============================================================================

describe('INV-AGT-SEL: Agent Selection Invariants', () => {
  describe('INV-AGT-SEL-001: Selection Determinism', () => {
    it('should produce same result for same input', () => {
      // Selection metadata for deterministic scoring
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent for selection',
        selectionMetadata: {
          primaryIntents: ['code review', 'testing'],
          keywords: ['review', 'test', 'quality'],
        },
      };

      const parsed1 = AgentProfileSchema.parse(profile);
      const parsed2 = AgentProfileSchema.parse(profile);
      const parsed3 = AgentProfileSchema.parse(profile);

      // Same profile should produce identical parsed results
      expect(parsed1.selectionMetadata).toEqual(parsed2.selectionMetadata);
      expect(parsed2.selectionMetadata).toEqual(parsed3.selectionMetadata);
    });

    it('should validate selection metadata schema', () => {
      const profile = {
        agentId: 'deterministic-agent',
        description: 'Agent with selection metadata',
        selectionMetadata: {
          primaryIntents: ['build', 'deploy'],
          secondarySignals: ['ci', 'cd'],
          keywords: ['pipeline', 'docker'],
          antiKeywords: ['manual', 'local'],
          exampleTasks: ['build the docker image', 'deploy to staging'],
          notForTasks: ['write tests', 'review code'],
          agentCategory: 'implementer',
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectionMetadata?.primaryIntents).toHaveLength(2);
        expect(result.data.selectionMetadata?.agentCategory).toBe('implementer');
      }
    });
  });

  describe('INV-AGT-SEL-002: Confidence Range', () => {
    it('should validate AgentRecommendResult confidence is between 0 and 1', () => {
      // Test schema validation for confidence range
      const validResult = {
        recommended: 'test-agent',
        confidence: 0.85,
        reason: 'Best match for task',
        alternatives: [],
      };

      const result = AgentRecommendResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should reject confidence below 0', () => {
      const invalidResult = {
        recommended: 'test-agent',
        confidence: -0.5, // Invalid: below 0
        reason: 'Invalid confidence',
        alternatives: [],
      };

      const result = AgentRecommendResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject confidence above 1', () => {
      const invalidResult = {
        recommended: 'test-agent',
        confidence: 1.5, // Invalid: above 1
        reason: 'Invalid confidence',
        alternatives: [],
      };

      const result = AgentRecommendResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should accept boundary values 0 and 1', () => {
      const zeroConfidence = {
        recommended: 'fallback-agent',
        confidence: 0,
        reason: 'No match found',
        alternatives: [],
      };

      const maxConfidence = {
        recommended: 'best-agent',
        confidence: 1,
        reason: 'Perfect match',
        alternatives: [],
      };

      expect(AgentRecommendResultSchema.safeParse(zeroConfidence).success).toBe(true);
      expect(AgentRecommendResultSchema.safeParse(maxConfidence).success).toBe(true);
    });
  });

  describe('INV-AGT-SEL-003: Result Ordering', () => {
    it('should validate alternatives have required fields', () => {
      const result = {
        recommended: 'best-agent',
        confidence: 0.9,
        reason: 'Best match',
        alternatives: [
          { agentId: 'second-agent', confidence: 0.7 },
          { agentId: 'third-agent', confidence: 0.5 },
        ],
      };

      const parsed = AgentRecommendResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.alternatives).toHaveLength(2);
        expect(parsed.data.alternatives[0]!.confidence).toBe(0.7);
      }
    });

    it('should validate AgentMatch schema in alternatives', () => {
      const match = {
        agentId: 'test-agent',
        confidence: 0.75,
        reason: 'Partial match',
      };

      const result = AgentMatchSchema.safeParse(match);
      expect(result.success).toBe(true);
    });
  });

  describe('INV-AGT-SEL-004: Fallback Agent', () => {
    it('should support standard agent profile', () => {
      // The standard agent is the fallback - must always exist
      const standardProfile = {
        agentId: 'standard',
        description: 'Default fallback agent for general tasks',
        selectionMetadata: {
          agentCategory: 'generalist',
          exampleTasks: ['help me with this task', 'general coding'],
        },
        enabled: true,
      };

      const result = AgentProfileSchema.safeParse(standardProfile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectionMetadata?.agentCategory).toBe('generalist');
        expect(result.data.enabled).toBe(true);
      }
    });

    it('should validate AgentRecommendRequest schema', () => {
      const request = {
        task: 'Review this pull request',
        team: 'engineering',
        requiredCapabilities: ['code-review'],
        excludeAgents: ['backend'],
        maxResults: 3,
      };

      const result = AgentRecommendRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should require task in request', () => {
      const invalidRequest = {
        team: 'engineering',
        maxResults: 3,
      };

      const result = AgentRecommendRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should default maxResults to 3', () => {
      const request = {
        task: 'Some task',
      };

      const parsed = AgentRecommendRequestSchema.parse(request);
      expect(parsed.maxResults).toBe(3);
    });
  });

  describe('INV-AGT-SEL-005: Example Task Matching', () => {
    it('should support exampleTasks in selection metadata', () => {
      const profile = {
        agentId: 'backend-agent',
        description: 'Backend development agent',
        selectionMetadata: {
          exampleTasks: [
            'create a REST API endpoint',
            'write database migrations',
            'optimize SQL queries',
            'implement authentication',
          ],
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectionMetadata?.exampleTasks).toHaveLength(4);
        expect(result.data.selectionMetadata?.exampleTasks![0]).toBe('create a REST API endpoint');
      }
    });

    it('should enforce exampleTasks max length', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent',
        selectionMetadata: {
          exampleTasks: Array(11).fill('task'), // Max is 10
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should enforce individual exampleTask max length', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent',
        selectionMetadata: {
          exampleTasks: ['a'.repeat(201)], // Max is 200
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });

  describe('INV-AGT-SEL-006: Negative Task Exclusion', () => {
    it('should support notForTasks in selection metadata', () => {
      const profile = {
        agentId: 'frontend-agent',
        description: 'Frontend development agent',
        selectionMetadata: {
          notForTasks: [
            'database migrations',
            'backend API',
            'server configuration',
            'deployment scripts',
          ],
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectionMetadata?.notForTasks).toHaveLength(4);
        expect(result.data.selectionMetadata?.notForTasks![0]).toBe('database migrations');
      }
    });

    it('should enforce notForTasks max length', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent',
        selectionMetadata: {
          notForTasks: Array(11).fill('not this'), // Max is 10
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it('should support both exampleTasks and notForTasks together', () => {
      const profile = {
        agentId: 'reviewer-agent',
        description: 'Code review specialist',
        selectionMetadata: {
          agentCategory: 'reviewer',
          exampleTasks: ['review pull request', 'code review'],
          notForTasks: ['write code', 'implement feature'],
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectionMetadata?.exampleTasks).toHaveLength(2);
        expect(result.data.selectionMetadata?.notForTasks).toHaveLength(2);
        expect(result.data.selectionMetadata?.agentCategory).toBe('reviewer');
      }
    });
  });

  describe('AgentCategory Validation', () => {
    it('should validate all category values', () => {
      const categories = ['orchestrator', 'implementer', 'reviewer', 'specialist', 'generalist'];

      for (const category of categories) {
        const profile = {
          agentId: `${category}-agent`,
          description: `A ${category} agent`,
          selectionMetadata: {
            agentCategory: category,
          },
        };

        const result = AgentProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid category', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test agent',
        selectionMetadata: {
          agentCategory: 'invalid-category',
        },
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });

  describe('AgentCapabilitiesRequest Validation', () => {
    it('should validate capabilities request', () => {
      const request = {
        category: 'implementer',
        includeDisabled: false,
      };

      const result = AgentCapabilitiesRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should default includeDisabled to false', () => {
      const request = {};

      const parsed = AgentCapabilitiesRequestSchema.parse(request);
      expect(parsed.includeDisabled).toBe(false);
    });
  });

  describe('AgentCapabilitiesResult Validation', () => {
    it('should validate capabilities result', () => {
      const result = {
        capabilities: ['code-review', 'testing', 'deployment'],
        agentsByCapability: {
          'code-review': ['reviewer', 'backend'],
          testing: ['qa-engineer'],
          deployment: ['devops'],
        },
        capabilitiesByAgent: {
          reviewer: ['code-review'],
          backend: ['code-review'],
          'qa-engineer': ['testing'],
          devops: ['deployment'],
        },
        categoriesByAgent: {
          reviewer: 'reviewer',
          backend: 'implementer',
          'qa-engineer': 'specialist',
          devops: 'implementer',
        },
      };

      const validation = AgentCapabilitiesResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });
});

// ============================================================================
// Capability Mapping Invariant Tests (INV-CAP-001 to INV-CAP-005)
// ============================================================================

describe('INV-CAP: Capability Mapping Invariants', () => {
  describe('CapabilityMappingSchema Validation', () => {
    it('should validate a minimal capability mapping', () => {
      const mapping = {
        taskType: 'code-review',
        workflowRef: 'std/code-review',
      };

      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [mapping],
      });
      expect(result.success).toBe(true);
    });

    it('should validate a full capability mapping', () => {
      const mapping = {
        taskType: 'debugging',
        workflowRef: 'std/debugging',
        inputSchemaRef: 'debug-input',
        abilities: ['debugging', 'logging', 'tracing'],
        priority: 90,
        description: 'Debug code issues',
      };

      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [mapping],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilityMappings?.[0]?.priority).toBe(90);
      }
    });

    it('should validate all task types', () => {
      const taskTypes = [
        'code-review',
        'debugging',
        'refactoring',
        'api-design',
        'implementation',
        'testing',
        'documentation',
        'analysis',
        'planning',
        'general',
      ];

      for (const taskType of taskTypes) {
        const result = AgentProfileSchema.safeParse({
          agentId: 'test-agent',
          description: 'Test',
          capabilityMappings: [{ taskType, workflowRef: `std/${taskType}` }],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid task type', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{ taskType: 'invalid-type', workflowRef: 'std/test' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('INV-CAP-001: Valid Workflow Reference', () => {
    it('should accept standard workflow references (std/*)', () => {
      const mapping = {
        taskType: 'code-review',
        workflowRef: 'std/code-review',
      };

      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [mapping],
      });
      expect(result.success).toBe(true);
    });

    it('should accept custom workflow references', () => {
      const mapping = {
        taskType: 'implementation',
        workflowRef: 'custom/my-workflow.yaml',
      };

      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [mapping],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty workflow reference', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{ taskType: 'code-review', workflowRef: '' }],
      });
      expect(result.success).toBe(false);
    });

    it('should enforce max workflow reference length', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{
          taskType: 'code-review',
          workflowRef: 'a'.repeat(201), // Max is 200
        }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('INV-CAP-002: Input Schema Validation', () => {
    it('should accept optional inputSchemaRef', () => {
      const mapping = {
        taskType: 'code-review',
        workflowRef: 'std/code-review',
        inputSchemaRef: 'review-input-schema',
      };

      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [mapping],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilityMappings?.[0]?.inputSchemaRef).toBe('review-input-schema');
      }
    });

    it('should enforce max inputSchemaRef length', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{
          taskType: 'code-review',
          workflowRef: 'std/code-review',
          inputSchemaRef: 'a'.repeat(101), // Max is 100
        }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('INV-CAP-003: Standard Workflow Sharing', () => {
    it('should distinguish standard from custom workflow references', () => {
      const standardRef = 'std/code-review';
      const customRef = 'custom/my-workflow';

      // Standard workflows start with 'std/'
      expect(standardRef.startsWith('std/')).toBe(true);
      expect(customRef.startsWith('std/')).toBe(false);
    });

    it('should validate multiple agents can reference same standard workflow', () => {
      const agents = [
        {
          agentId: 'reviewer-1',
          description: 'First reviewer',
          capabilityMappings: [{ taskType: 'code-review', workflowRef: 'std/code-review' }],
        },
        {
          agentId: 'reviewer-2',
          description: 'Second reviewer',
          capabilityMappings: [{ taskType: 'code-review', workflowRef: 'std/code-review' }],
        },
      ];

      for (const agent of agents) {
        const result = AgentProfileSchema.safeParse(agent);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.capabilityMappings?.[0]?.workflowRef).toBe('std/code-review');
        }
      }
    });
  });

  describe('INV-CAP-004: Classification Determinism', () => {
    it('should validate same capability mapping produces same parsed result', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [
          { taskType: 'code-review', workflowRef: 'std/code-review', priority: 90 },
          { taskType: 'debugging', workflowRef: 'std/debugging', priority: 80 },
        ],
      };

      const parsed1 = AgentProfileSchema.parse(profile);
      const parsed2 = AgentProfileSchema.parse(profile);
      const parsed3 = AgentProfileSchema.parse(profile);

      expect(parsed1.capabilityMappings).toEqual(parsed2.capabilityMappings);
      expect(parsed2.capabilityMappings).toEqual(parsed3.capabilityMappings);
    });
  });

  describe('INV-CAP-005: Fallback Behavior', () => {
    it('should allow agent without capability mappings (uses default workflow)', () => {
      const profile = {
        agentId: 'simple-agent',
        description: 'Agent without capability mappings',
        workflow: [
          { stepId: 'default', name: 'Default Step', type: 'prompt', config: { prompt: 'Process task' } },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilityMappings).toBeUndefined();
        expect(result.data.workflow).toHaveLength(1);
      }
    });

    it('should allow empty capability mappings array', () => {
      const profile = {
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [],
        workflow: [
          { stepId: 'fallback', name: 'Fallback', type: 'prompt', config: { prompt: 'Handle any task' } },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe('Capability Abilities Validation', () => {
    it('should validate abilities array in capability mapping', () => {
      const mapping = {
        taskType: 'code-review',
        workflowRef: 'std/code-review',
        abilities: ['code-review', 'static-analysis', 'best-practices'],
      };

      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [mapping],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilityMappings?.[0]?.abilities).toHaveLength(3);
      }
    });

    it('should enforce max abilities per capability', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{
          taskType: 'code-review',
          workflowRef: 'std/code-review',
          abilities: Array(21).fill('ability'), // Max is 20
        }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Priority Validation', () => {
    it('should default priority to 50', () => {
      const result = AgentProfileSchema.parse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{ taskType: 'code-review', workflowRef: 'std/code-review' }],
      });
      expect(result.capabilityMappings?.[0]?.priority).toBe(50);
    });

    it('should accept priority range 0-100', () => {
      const priorities = [0, 25, 50, 75, 100];

      for (const priority of priorities) {
        const result = AgentProfileSchema.safeParse({
          agentId: 'test-agent',
          description: 'Test',
          capabilityMappings: [{ taskType: 'code-review', workflowRef: 'std/code-review', priority }],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject priority below 0', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{ taskType: 'code-review', workflowRef: 'std/code-review', priority: -1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject priority above 100', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: [{ taskType: 'code-review', workflowRef: 'std/code-review', priority: 101 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Multiple Capability Mappings', () => {
    it('should validate agent with multiple capability mappings', () => {
      const profile = {
        agentId: 'multi-capable-agent',
        description: 'Agent with multiple capabilities',
        capabilityMappings: [
          { taskType: 'code-review', workflowRef: 'std/code-review', priority: 95 },
          { taskType: 'debugging', workflowRef: 'std/debugging', priority: 90 },
          { taskType: 'refactoring', workflowRef: 'std/refactoring', priority: 80 },
          { taskType: 'testing', workflowRef: 'std/testing', priority: 70 },
          { taskType: 'implementation', workflowRef: 'std/implementation', priority: 85 },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilityMappings).toHaveLength(5);
      }
    });

    it('should enforce max capability mappings (20)', () => {
      const result = AgentProfileSchema.safeParse({
        agentId: 'test-agent',
        description: 'Test',
        capabilityMappings: Array(21).fill({ taskType: 'code-review', workflowRef: 'std/test' }),
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Workflow Step Invariant Tests (INV-AGT-WF-001 to INV-AGT-WF-003)
// ============================================================================

describe('INV-AGT-WF: Workflow Step Invariants', () => {
  describe('INV-AGT-WF-001: Prompt Step Validation', () => {
    it('should accept prompt step with prompt in config', () => {
      const step = {
        stepId: 'analyze',
        name: 'Analyze Code',
        type: 'prompt',
        config: { prompt: 'Analyze the following code for issues' },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should accept prompt step with non-empty prompt', () => {
      const profile = {
        agentId: 'prompt-agent',
        description: 'Agent with prompt steps',
        workflow: [
          {
            stepId: 'step-1',
            name: 'First Prompt',
            type: 'prompt',
            config: { prompt: 'Execute the task' },
          },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe('INV-AGT-WF-002: Delegate Step Validation', () => {
    it('should accept delegate step with targetAgent', () => {
      const step = {
        stepId: 'delegate-review',
        name: 'Delegate to Reviewer',
        type: 'delegate',
        config: { targetAgent: 'code-reviewer' },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should accept delegate step in agent profile', () => {
      const profile = {
        agentId: 'orchestrator',
        description: 'Orchestrator agent',
        workflow: [
          {
            stepId: 'delegate-1',
            name: 'Delegate Task',
            type: 'delegate',
            config: { targetAgent: 'backend-agent' },
          },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe('INV-AGT-WF-003: Dependency Validation', () => {
    it('should accept step with dependencies', () => {
      const step = {
        stepId: 'summarize',
        name: 'Summarize Results',
        type: 'prompt',
        config: { prompt: 'Summarize' },
        dependencies: ['analyze', 'review'],
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dependencies).toContain('analyze');
        expect(result.data.dependencies).toContain('review');
      }
    });

    it('should accept workflow with chained dependencies', () => {
      const profile = {
        agentId: 'chain-agent',
        description: 'Agent with chained steps',
        workflow: [
          { stepId: 'step-1', name: 'First', type: 'prompt', config: { prompt: 'First step' } },
          { stepId: 'step-2', name: 'Second', type: 'prompt', config: { prompt: 'Second step' }, dependencies: ['step-1'] },
          { stepId: 'step-3', name: 'Third', type: 'prompt', config: { prompt: 'Third step' }, dependencies: ['step-2'] },
        ],
      };

      const result = AgentProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workflow?.[2]?.dependencies).toContain('step-2');
      }
    });
  });

  describe('Workflow Step Type Validation', () => {
    it('should validate all step types', () => {
      const stepTypes = ['prompt', 'tool', 'conditional', 'loop', 'parallel', 'delegate', 'discuss'];

      for (const type of stepTypes) {
        const step = {
          stepId: `${type}-step`,
          name: `${type} Step`,
          type,
          config: {},
        };
        const result = AgentWorkflowStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid step type', () => {
      const step = {
        stepId: 'invalid',
        name: 'Invalid Step',
        type: 'invalid-type',
        config: {},
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe('Tool Step Validation', () => {
    it('should accept tool step with tool name', () => {
      const step = {
        stepId: 'call-api',
        name: 'Call API',
        type: 'tool',
        config: { tool: 'review_analyze', inputMapping: { paths: '${input.paths}' } },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('Parallel Step Validation', () => {
    it('should accept parallel step', () => {
      const step = {
        stepId: 'parallel-tasks',
        name: 'Parallel Tasks',
        type: 'parallel',
        config: { branches: ['analyze', 'review'] },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('Conditional Step Validation', () => {
    it('should accept conditional step', () => {
      const step = {
        stepId: 'check-condition',
        name: 'Check Condition',
        type: 'conditional',
        config: { condition: '${input.needsReview}', then: 'review', else: 'skip' },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('Step Timeout Validation', () => {
    it('should accept step with timeout', () => {
      const step = {
        stepId: 'long-task',
        name: 'Long Running Task',
        type: 'tool',
        config: {},
        timeoutMs: 120000,
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(120000);
      }
    });
  });

  describe('Step Retry Policy Validation', () => {
    it('should accept step with retry policy', () => {
      const step = {
        stepId: 'retry-step',
        name: 'Retry Step',
        type: 'tool',
        config: {},
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
          backoffMultiplier: 2,
          retryOn: ['timeout', 'serverError'],
        },
      };

      const result = AgentWorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.retryPolicy?.maxAttempts).toBe(3);
      }
    });
  });
});

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
