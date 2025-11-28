/**
 * Agent Schema Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  PersonalitySchema,
  AbilitySelectionSchema,
  OrchestrationSchema,
  AgentProfileSchema,
  ExecutionContextSchema,
  AgentResponseSchema,
  CommunicationStyle,
  DecisionMaking,
  validateAgentProfile,
  safeValidateAgentProfile,
} from './agent.js';

describe('CommunicationStyle', () => {
  it('should accept valid communication styles', () => {
    expect(CommunicationStyle.parse('formal')).toBe('formal');
    expect(CommunicationStyle.parse('casual')).toBe('casual');
    expect(CommunicationStyle.parse('technical')).toBe('technical');
    expect(CommunicationStyle.parse('friendly')).toBe('friendly');
  });

  it('should reject invalid communication style', () => {
    expect(() => CommunicationStyle.parse('invalid')).toThrow();
  });
});

describe('DecisionMaking', () => {
  it('should accept valid decision making styles', () => {
    expect(DecisionMaking.parse('data-driven')).toBe('data-driven');
    expect(DecisionMaking.parse('intuitive')).toBe('intuitive');
    expect(DecisionMaking.parse('collaborative')).toBe('collaborative');
    expect(DecisionMaking.parse('analytical')).toBe('analytical');
  });
});

describe('PersonalitySchema', () => {
  it('should validate minimal personality', () => {
    const result = PersonalitySchema.parse({
      traits: ['analytical'],
    });

    expect(result.traits).toContain('analytical');
    expect(result.communicationStyle).toBe('technical'); // default
    expect(result.decisionMaking).toBe('data-driven'); // default
  });

  it('should validate full personality', () => {
    const result = PersonalitySchema.parse({
      traits: ['analytical', 'thorough', 'patient'],
      catchphrase: 'Let me analyze that for you!',
      communicationStyle: 'formal',
      decisionMaking: 'collaborative',
    });

    expect(result.traits).toHaveLength(3);
    expect(result.catchphrase).toBe('Let me analyze that for you!');
    expect(result.communicationStyle).toBe('formal');
  });

  it('should reject empty traits', () => {
    expect(() => PersonalitySchema.parse({ traits: [] })).toThrow();
  });

  it('should reject too many traits', () => {
    expect(() => PersonalitySchema.parse({
      traits: ['a', 'b', 'c', 'd', 'e', 'f'], // 6 > max 5
    })).toThrow();
  });

  it('should reject too long catchphrase', () => {
    expect(() => PersonalitySchema.parse({
      traits: ['test'],
      catchphrase: 'x'.repeat(201), // > 200 chars
    })).toThrow();
  });
});

describe('AbilitySelectionSchema', () => {
  it('should use defaults', () => {
    const result = AbilitySelectionSchema.parse({});

    expect(result.core).toEqual([]);
    expect(result.taskBased).toEqual({});
  });

  it('should validate ability selection', () => {
    const result = AbilitySelectionSchema.parse({
      core: ['code-generation', 'debugging'],
      taskBased: {
        testing: ['unit-test', 'integration-test'],
        review: ['code-review'],
      },
    });

    expect(result.core).toContain('code-generation');
    expect(result.taskBased['testing']).toContain('unit-test');
  });
});

describe('OrchestrationSchema', () => {
  it('should use defaults', () => {
    const result = OrchestrationSchema.parse({});

    expect(result.maxDelegationDepth).toBe(0);
    expect(result.canReadWorkspaces).toEqual([]);
    expect(result.canWriteToShared).toBe(false);
    expect(result.canDelegateTo).toEqual([]);
    expect(result.priority).toBe(5);
  });

  it('should validate orchestration settings', () => {
    const result = OrchestrationSchema.parse({
      maxDelegationDepth: 2,
      canReadWorkspaces: ['shared', 'team'],
      canWriteToShared: true,
      canDelegateTo: ['frontend', 'quality'],
      priority: 1,
    });

    expect(result.maxDelegationDepth).toBe(2);
    expect(result.canDelegateTo).toContain('frontend');
  });

  it('should reject invalid delegation depth', () => {
    expect(() => OrchestrationSchema.parse({
      maxDelegationDepth: 5, // > max 3
    })).toThrow();
  });

  it('should reject invalid priority', () => {
    expect(() => OrchestrationSchema.parse({
      priority: 0, // < min 1
    })).toThrow();
  });
});

describe('AgentProfileSchema', () => {
  const validProfile = {
    name: 'backend',
    displayName: 'Bob Backend',
    role: 'Backend Developer',
    systemPrompt: 'You are a backend developer with expertise in building APIs and services.',
  };

  it('should validate minimal profile', () => {
    const result = AgentProfileSchema.parse(validProfile);

    expect(result.name).toBe('backend');
    expect(result.displayName).toBe('Bob Backend');
    expect(result.enabled).toBe(true); // default
    expect(result.version).toBe('1.0.0'); // default
    expect(result.team).toBe('default'); // default
  });

  it('should validate full profile', () => {
    const result = AgentProfileSchema.parse({
      ...validProfile,
      team: 'engineering',
      description: 'Expert in Go and Rust backend systems',
      abilities: ['code-generation', 'api-design', 'database'],
      personality: {
        traits: ['analytical', 'thorough'],
        communicationStyle: 'technical',
      },
      orchestration: {
        maxDelegationDepth: 2,
        canDelegateTo: ['frontend'],
      },
      enabled: true,
      version: '2.0.0',
      metadata: { specialist: true },
    });

    expect(result.team).toBe('engineering');
    expect(result.abilities).toContain('api-design');
    expect(result.personality?.traits).toContain('analytical');
  });

  it('should reject invalid agent name', () => {
    expect(() => AgentProfileSchema.parse({
      ...validProfile,
      name: 'Invalid Name With Spaces',
    })).toThrow();
  });

  it('should reject too short system prompt', () => {
    expect(() => AgentProfileSchema.parse({
      ...validProfile,
      systemPrompt: 'short', // < 10 chars
    })).toThrow();
  });

  it('should reject empty display name', () => {
    expect(() => AgentProfileSchema.parse({
      ...validProfile,
      displayName: '',
    })).toThrow();
  });
});

describe('ExecutionContextSchema', () => {
  it('should validate minimal context', () => {
    const result = ExecutionContextSchema.parse({
      task: 'Build an API endpoint',
    });

    expect(result.task).toBe('Build an API endpoint');
    expect(result.delegationChain).toEqual([]);
    expect(result.timeout).toBe(300000);
    expect(result.stream).toBe(false);
  });

  it('should validate full context', () => {
    const result = ExecutionContextSchema.parse({
      task: 'Build an API endpoint',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      parentAgentId: 'product',
      delegationChain: ['ceo', 'product'],
      memoryContext: [{ id: 1, content: 'Previous context' }],
      context: { priority: 'high' },
      timeout: 60000,
      stream: true,
    });

    expect(result.sessionId).toBeDefined();
    expect(result.delegationChain).toHaveLength(2);
    expect(result.timeout).toBe(60000);
  });

  it('should reject empty task', () => {
    expect(() => ExecutionContextSchema.parse({
      task: '',
    })).toThrow();
  });
});

describe('AgentResponseSchema', () => {
  it('should validate successful response', () => {
    const result = AgentResponseSchema.parse({
      success: true,
      output: 'API endpoint created successfully',
      agentId: 'backend',
      duration: 5000,
      provider: 'claude',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('successfully');
    expect(result.delegations).toEqual([]);
  });

  it('should validate response with delegations', () => {
    const result = AgentResponseSchema.parse({
      success: true,
      output: 'Delegated to frontend',
      agentId: 'backend',
      duration: 1000,
      delegations: [
        { toAgent: 'frontend', task: 'Create UI', status: 'pending' },
      ],
    });

    expect(result.delegations).toHaveLength(1);
    expect(result.delegations[0]?.status).toBe('pending');
  });

  it('should validate failed response', () => {
    const result = AgentResponseSchema.parse({
      success: false,
      output: '',
      agentId: 'backend',
      duration: 100,
      error: {
        code: 'TIMEOUT',
        message: 'Execution timed out',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TIMEOUT');
  });

  it('should validate response with tokens', () => {
    const result = AgentResponseSchema.parse({
      success: true,
      output: 'Done',
      agentId: 'backend',
      duration: 2000,
      tokens: {
        input: 100,
        output: 50,
      },
    });

    expect(result.tokens?.input).toBe(100);
    expect(result.tokens?.output).toBe(50);
  });
});

describe('validateAgentProfile', () => {
  it('should validate valid profile', () => {
    const profile = validateAgentProfile({
      name: 'test-agent',
      displayName: 'Test Agent',
      role: 'Tester',
      systemPrompt: 'You are a test agent for validation.',
    });

    expect(profile.name).toBe('test-agent');
  });

  it('should throw for invalid profile', () => {
    expect(() => validateAgentProfile({
      name: 'invalid name',
    })).toThrow();
  });
});

describe('safeValidateAgentProfile', () => {
  it('should return success for valid profile', () => {
    const result = safeValidateAgentProfile({
      name: 'test-agent',
      displayName: 'Test Agent',
      role: 'Tester',
      systemPrompt: 'You are a test agent for validation.',
    });

    expect(result.success).toBe(true);
  });

  it('should return error for invalid profile', () => {
    const result = safeValidateAgentProfile({
      name: 'invalid name',
    });

    expect(result.success).toBe(false);
  });
});
