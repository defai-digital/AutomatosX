/**
 * Discuss MCP Tool Contract Tests
 *
 * Tests for the discuss and discuss_quick MCP tools.
 */

import { describe, it, expect } from 'vitest';
import {
  // Discussion schemas
  DiscussionPatternSchema,
  ConsensusMethodSchema,
  ConsensusConfigSchema,
  DiscussStepConfigSchema,
  DiscussionProviderResponseSchema,
  DiscussionRoundSchema,
  VoteRecordSchema,
  VotingResultsSchema,
  ConsensusResultSchema,
  DiscussionResultSchema,
  DiscussionRequestSchema,
  DiscussionErrorCodes,
  DEFAULT_PROVIDERS,
  MIN_PROVIDERS,
  MAX_PROVIDERS,
  MAX_ROUNDS,
  DEFAULT_ROUNDS,
  DEFAULT_PROVIDER_TIMEOUT,

  // Validation functions
  validateDiscussStepConfig,
  safeValidateDiscussStepConfig,
  validateDiscussionRequest,
  safeValidateDiscussionRequest,
  validateDiscussionResult,
  safeValidateDiscussionResult,

  // Factory functions
  createDefaultDiscussStepConfig,
  createDebateConfig,
  createVotingConfig,
  createEmptyDiscussionResult,
  createFailedDiscussionResult,

  // Types
  type DiscussionPattern,
  type ConsensusMethod,
  type DiscussStepConfig,
  type DiscussionResult,
  type DiscussionRequest,
} from '@defai.digital/contracts';

// ============================================================================
// Discussion Pattern Schema Tests
// ============================================================================

describe('Discussion Contract - Pattern Schema', () => {
  it('should accept all valid patterns', () => {
    const validPatterns: DiscussionPattern[] = [
      'round-robin',
      'debate',
      'critique',
      'voting',
      'synthesis',
    ];

    for (const pattern of validPatterns) {
      const result = DiscussionPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid pattern', () => {
    const result = DiscussionPatternSchema.safeParse('invalid-pattern');
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Consensus Method Schema Tests
// ============================================================================

describe('Discussion Contract - Consensus Method', () => {
  it('should accept all valid consensus methods', () => {
    const validMethods: ConsensusMethod[] = [
      'synthesis',
      'voting',
      'moderator',
      'unanimous',
      'majority',
    ];

    for (const method of validMethods) {
      const result = ConsensusMethodSchema.safeParse(method);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid consensus method', () => {
    const result = ConsensusMethodSchema.safeParse('invalid-method');
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Consensus Configuration Tests
// ============================================================================

describe('Discussion Contract - Consensus Config', () => {
  it('should validate valid consensus config with defaults', () => {
    const result = ConsensusConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('synthesis');
      expect(result.data.threshold).toBe(0.5);
      expect(result.data.includeDissent).toBe(true);
    }
  });

  it('should validate full consensus config', () => {
    const config = {
      method: 'moderator',
      synthesizer: 'claude',
      threshold: 0.7,
      includeDissent: false,
      synthesisPrompt: 'Summarize the discussion',
    };

    const result = ConsensusConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should reject moderator method without synthesizer (INV-DISC-003)', () => {
    const config = {
      method: 'moderator',
      // synthesizer missing
    };

    const result = ConsensusConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('INV-DISC-003');
    }
  });

  it('should reject threshold outside 0-1 range', () => {
    const result = ConsensusConfigSchema.safeParse({
      method: 'voting',
      threshold: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative threshold', () => {
    const result = ConsensusConfigSchema.safeParse({
      method: 'voting',
      threshold: -0.1,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Discussion Step Configuration Tests
// ============================================================================

describe('Discussion Contract - DiscussStepConfig', () => {
  describe('valid configurations', () => {
    it('should validate minimal config', () => {
      const config = {
        providers: ['claude', 'grok'],
        prompt: 'What is the best approach?',
      };

      const result = DiscussStepConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pattern).toBe('synthesis');
        expect(result.data.rounds).toBe(DEFAULT_ROUNDS);
        expect(result.data.providerTimeout).toBe(DEFAULT_PROVIDER_TIMEOUT);
      }
    });

    it('should validate full config', () => {
      const config = {
        pattern: 'synthesis',
        rounds: 3,
        providers: ['claude', 'grok', 'gemini'],
        prompt: 'Discuss the topic',
        consensus: { method: 'synthesis', synthesizer: 'claude' },
        providerTimeout: 30000,
        continueOnProviderFailure: false,
        minProviders: 2,
        temperature: 0.8,
        verbose: true,
        context: 'Additional context here',
      };

      const result = DiscussStepConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        // Verify defaults were applied
        expect(result.data.consensus.threshold).toBe(0.5);
        expect(result.data.consensus.includeDissent).toBe(true);
      }
    });
  });

  describe('provider validation (INV-DISC-005, INV-DISC-006)', () => {
    it('should reject less than 2 providers', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude'],
        prompt: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject more than 6 providers', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        prompt: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('should accept exactly MIN_PROVIDERS', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
      });
      expect(result.success).toBe(true);
      expect(MIN_PROVIDERS).toBe(2);
    });

    it('should accept exactly MAX_PROVIDERS', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['a', 'b', 'c', 'd', 'e', 'f'],
        prompt: 'Test',
      });
      expect(result.success).toBe(true);
      expect(MAX_PROVIDERS).toBe(6);
    });
  });

  describe('round validation (INV-DISC-007)', () => {
    it('should reject zero rounds', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        rounds: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject more than MAX_ROUNDS', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        rounds: MAX_ROUNDS + 1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept rounds at boundary', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        rounds: MAX_ROUNDS,
      });
      expect(result.success).toBe(true);
      expect(MAX_ROUNDS).toBe(10);
    });
  });

  describe('debate pattern validation (INV-DISC-008)', () => {
    it('should reject debate pattern without roles', () => {
      const result = DiscussStepConfigSchema.safeParse({
        pattern: 'debate',
        providers: ['claude', 'grok', 'gemini'],
        prompt: 'Debate topic',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('INV-DISC-008');
      }
    });

    it('should accept debate pattern with roles', () => {
      const result = DiscussStepConfigSchema.safeParse({
        pattern: 'debate',
        providers: ['claude', 'grok', 'gemini'],
        prompt: 'Debate topic',
        roles: {
          claude: 'proponent',
          grok: 'opponent',
          gemini: 'judge',
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('minProviders validation', () => {
    it('should reject minProviders exceeding providers count', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        minProviders: 3,
      });
      expect(result.success).toBe(false);
    });

    it('should accept minProviders equal to providers count', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        minProviders: 2,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('temperature validation', () => {
    it('should reject temperature below 0', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        temperature: -0.1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject temperature above 2', () => {
      const result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        temperature: 2.1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept temperature at boundaries', () => {
      let result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        temperature: 0,
      });
      expect(result.success).toBe(true);

      result = DiscussStepConfigSchema.safeParse({
        providers: ['claude', 'grok'],
        prompt: 'Test',
        temperature: 2,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Provider Response Schema Tests
// ============================================================================

describe('Discussion Contract - Provider Response', () => {
  it('should validate minimal response', () => {
    const response = {
      provider: 'claude',
      content: 'Response content',
      round: 1,
      timestamp: new Date().toISOString(),
      durationMs: 500,
    };

    const result = DiscussionProviderResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate full response with all fields', () => {
    const response = {
      provider: 'claude',
      content: 'Response content',
      round: 2,
      role: 'proponent',
      confidence: 0.85,
      vote: 'Option A',
      timestamp: new Date().toISOString(),
      durationMs: 1500,
      tokenCount: 250,
      truncated: false,
    };

    const result = DiscussionProviderResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate error response', () => {
    const response = {
      provider: 'grok',
      content: '',
      round: 1,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      error: 'Provider timeout',
    };

    const result = DiscussionProviderResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should reject invalid confidence score', () => {
    const response = {
      provider: 'claude',
      content: 'Test',
      round: 1,
      timestamp: new Date().toISOString(),
      durationMs: 100,
      confidence: 1.5,
    };

    const result = DiscussionProviderResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Discussion Round Schema Tests
// ============================================================================

describe('Discussion Contract - Discussion Round', () => {
  it('should validate valid round', () => {
    const round = {
      roundNumber: 1,
      responses: [
        {
          provider: 'claude',
          content: 'Test response',
          round: 1,
          timestamp: new Date().toISOString(),
          durationMs: 500,
        },
      ],
      durationMs: 600,
    };

    const result = DiscussionRoundSchema.safeParse(round);
    expect(result.success).toBe(true);
  });

  it('should validate round with summary', () => {
    const round = {
      roundNumber: 2,
      responses: [],
      summary: 'Round summary here',
      durationMs: 1000,
    };

    const result = DiscussionRoundSchema.safeParse(round);
    expect(result.success).toBe(true);
  });

  it('should reject zero round number', () => {
    const round = {
      roundNumber: 0,
      responses: [],
      durationMs: 0,
    };

    const result = DiscussionRoundSchema.safeParse(round);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Voting Results Schema Tests
// ============================================================================

describe('Discussion Contract - Voting Results', () => {
  it('should validate valid voting results', () => {
    const results = {
      winner: 'Option A',
      votes: { 'Option A': 3, 'Option B': 1 },
      weightedVotes: { 'Option A': 2.5, 'Option B': 0.8 },
      voteRecords: [
        { provider: 'claude', choice: 'Option A', confidence: 0.9 },
        { provider: 'grok', choice: 'Option A', confidence: 0.8 },
        { provider: 'grok', choice: 'Option A', confidence: 0.7 },
        { provider: 'gemini', choice: 'Option B', confidence: 0.6 },
      ],
      unanimous: false,
      margin: 0.5,
    };

    const result = VotingResultsSchema.safeParse(results);
    expect(result.success).toBe(true);
  });

  it('should validate vote record with reasoning', () => {
    const vote = {
      provider: 'claude',
      choice: 'Option A',
      confidence: 0.95,
      reasoning: 'This option provides better scalability',
    };

    const result = VoteRecordSchema.safeParse(vote);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Consensus Result Schema Tests
// ============================================================================

describe('Discussion Contract - Consensus Result', () => {
  it('should validate minimal consensus result', () => {
    const consensus = {
      method: 'synthesis',
    };

    const result = ConsensusResultSchema.safeParse(consensus);
    expect(result.success).toBe(true);
  });

  it('should validate full consensus result', () => {
    const consensus = {
      method: 'synthesis',
      synthesizer: 'claude',
      agreementScore: 0.85,
      agreements: ['Point 1', 'Point 2'],
      dissent: [
        {
          provider: 'grok',
          position: 'Disagrees on approach',
          keyPoints: ['Concern about scalability'],
        },
      ],
    };

    const result = ConsensusResultSchema.safeParse(consensus);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Discussion Result Schema Tests
// ============================================================================

describe('Discussion Contract - Discussion Result', () => {
  it('should validate successful result', () => {
    const now = new Date().toISOString();
    const discussionResult: DiscussionResult = {
      success: true,
      pattern: 'synthesis',
      topic: 'Test topic',
      participatingProviders: ['claude', 'grok'],
      failedProviders: [],
      rounds: [
        {
          roundNumber: 1,
          responses: [
            {
              provider: 'claude',
              content: 'Response',
              round: 1,
              timestamp: now,
              durationMs: 500,
            },
          ],
          durationMs: 600,
        },
      ],
      synthesis: 'Final synthesized output',
      consensus: { method: 'synthesis' },
      totalDurationMs: 1500,
      metadata: {
        startedAt: now,
        completedAt: now,
      },
    };

    const result = DiscussionResultSchema.safeParse(discussionResult);
    expect(result.success).toBe(true);
  });

  it('should validate failed result with error', () => {
    const now = new Date().toISOString();
    const discussionResult = {
      success: false,
      pattern: 'synthesis',
      topic: 'Test topic',
      participatingProviders: [],
      failedProviders: ['claude', 'grok'],
      rounds: [],
      synthesis: '',
      consensus: { method: 'synthesis' },
      totalDurationMs: 5000,
      metadata: {
        startedAt: now,
        completedAt: now,
      },
      error: {
        code: 'DISCUSSION_ALL_PROVIDERS_FAILED',
        message: 'All providers failed to respond',
        retryable: true,
      },
    };

    const result = DiscussionResultSchema.safeParse(discussionResult);
    expect(result.success).toBe(true);
  });

  it('should validate result with voting results', () => {
    const now = new Date().toISOString();
    const discussionResult = {
      success: true,
      pattern: 'voting',
      topic: 'Vote on best option',
      participatingProviders: ['claude', 'grok', 'gemini'],
      failedProviders: [],
      rounds: [],
      synthesis: 'Option A was selected',
      consensus: { method: 'voting' },
      votingResults: {
        winner: 'Option A',
        votes: { 'Option A': 2, 'Option B': 1 },
        weightedVotes: { 'Option A': 1.8, 'Option B': 0.9 },
        voteRecords: [
          { provider: 'claude', choice: 'Option A', confidence: 0.9 },
          { provider: 'grok', choice: 'Option A', confidence: 0.8 },
          { provider: 'grok', choice: 'Option B', confidence: 0.85 },
        ],
        unanimous: false,
        margin: 0.33,
      },
      totalDurationMs: 2000,
      metadata: {
        startedAt: now,
        completedAt: now,
      },
    };

    const result = DiscussionResultSchema.safeParse(discussionResult);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Discussion Request Schema Tests
// ============================================================================

describe('Discussion Contract - Discussion Request', () => {
  it('should validate minimal request', () => {
    const request: DiscussionRequest = {
      topic: 'What is the best approach?',
    };

    const result = DiscussionRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('should validate full request', () => {
    const request: DiscussionRequest = {
      topic: 'What is the best approach?',
      pattern: 'voting',
      providers: ['claude', 'grok', 'gemini'],
      rounds: 2,
      consensusMethod: 'voting',
      votingOptions: ['Option A', 'Option B', 'Option C'],
      context: 'Additional context',
      sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      verbose: true,
    };

    const result = DiscussionRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('should reject empty topic', () => {
    const result = DiscussionRequestSchema.safeParse({
      topic: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject topic exceeding max length', () => {
    const result = DiscussionRequestSchema.safeParse({
      topic: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sessionId format', () => {
    const result = DiscussionRequestSchema.safeParse({
      topic: 'Test',
      sessionId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Error Codes Tests
// ============================================================================

describe('Discussion Contract - Error Codes', () => {
  it('should have all expected error codes', () => {
    expect(DiscussionErrorCodes.INSUFFICIENT_PROVIDERS).toBe('DISCUSSION_INSUFFICIENT_PROVIDERS');
    expect(DiscussionErrorCodes.PROVIDER_TIMEOUT).toBe('DISCUSSION_PROVIDER_TIMEOUT');
    expect(DiscussionErrorCodes.ALL_PROVIDERS_FAILED).toBe('DISCUSSION_ALL_PROVIDERS_FAILED');
    expect(DiscussionErrorCodes.CONSENSUS_FAILED).toBe('DISCUSSION_CONSENSUS_FAILED');
    expect(DiscussionErrorCodes.INVALID_PATTERN).toBe('DISCUSSION_INVALID_PATTERN');
    expect(DiscussionErrorCodes.INVALID_ROLES).toBe('DISCUSSION_INVALID_ROLES');
    expect(DiscussionErrorCodes.SYNTHESIS_FAILED).toBe('DISCUSSION_SYNTHESIS_FAILED');
    expect(DiscussionErrorCodes.INVALID_CONFIG).toBe('DISCUSSION_INVALID_CONFIG');
    expect(DiscussionErrorCodes.PROVIDER_NOT_FOUND).toBe('DISCUSSION_PROVIDER_NOT_FOUND');
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('Discussion Contract - Validation Functions', () => {
  describe('validateDiscussStepConfig', () => {
    it('should return valid config', () => {
      const config = validateDiscussStepConfig({
        providers: ['claude', 'grok'],
        prompt: 'Test prompt',
      });
      expect(config.pattern).toBe('synthesis');
      expect(config.providers).toHaveLength(2);
    });

    it('should throw on invalid config', () => {
      expect(() =>
        validateDiscussStepConfig({
          providers: ['claude'], // Too few
          prompt: 'Test',
        })
      ).toThrow();
    });
  });

  describe('safeValidateDiscussStepConfig', () => {
    it('should return success for valid config', () => {
      const result = safeValidateDiscussStepConfig({
        providers: ['claude', 'grok'],
        prompt: 'Test',
      });
      expect(result.success).toBe(true);
    });

    it('should return error for invalid config', () => {
      const result = safeValidateDiscussStepConfig({
        providers: [],
        prompt: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateDiscussionRequest', () => {
    it('should return valid request', () => {
      const request = validateDiscussionRequest({
        topic: 'Test topic',
      });
      expect(request.topic).toBe('Test topic');
    });

    it('should throw on invalid request', () => {
      expect(() => validateDiscussionRequest({ topic: '' })).toThrow();
    });
  });

  describe('safeValidateDiscussionRequest', () => {
    it('should return success for valid request', () => {
      const result = safeValidateDiscussionRequest({ topic: 'Test' });
      expect(result.success).toBe(true);
    });

    it('should return error for invalid request', () => {
      const result = safeValidateDiscussionRequest({ topic: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('validateDiscussionResult', () => {
    it('should return valid result', () => {
      const now = new Date().toISOString();
      const result = validateDiscussionResult({
        success: true,
        pattern: 'synthesis',
        topic: 'Test',
        participatingProviders: [],
        failedProviders: [],
        rounds: [],
        synthesis: 'Result',
        consensus: { method: 'synthesis' },
        totalDurationMs: 1000,
        metadata: { startedAt: now, completedAt: now },
      });
      expect(result.success).toBe(true);
    });

    it('should throw on invalid result', () => {
      expect(() => validateDiscussionResult({})).toThrow();
    });
  });

  describe('safeValidateDiscussionResult', () => {
    it('should return success for valid result', () => {
      const now = new Date().toISOString();
      const result = safeValidateDiscussionResult({
        success: true,
        pattern: 'synthesis',
        topic: 'Test',
        participatingProviders: [],
        failedProviders: [],
        rounds: [],
        synthesis: '',
        consensus: { method: 'synthesis' },
        totalDurationMs: 0,
        metadata: { startedAt: now, completedAt: now },
      });
      expect(result.success).toBe(true);
    });

    it('should return error for invalid result', () => {
      const result = safeValidateDiscussionResult({});
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Discussion Contract - Factory Functions', () => {
  describe('createDefaultDiscussStepConfig', () => {
    it('should create valid default config', () => {
      const config = createDefaultDiscussStepConfig('Test prompt');
      expect(config.pattern).toBe('synthesis');
      expect(config.prompt).toBe('Test prompt');
      expect(config.providers).toEqual([...DEFAULT_PROVIDERS]);
      expect(config.rounds).toBe(DEFAULT_ROUNDS);
    });

    it('should accept custom providers', () => {
      const config = createDefaultDiscussStepConfig('Test', ['claude', 'grok']);
      expect(config.providers).toEqual(['claude', 'grok']);
    });
  });

  describe('createDebateConfig', () => {
    it('should create valid debate config', () => {
      const config = createDebateConfig('Debate topic');
      expect(config.pattern).toBe('debate');
      expect(config.providers).toContain('claude');
      expect(config.providers).toContain('grok');
      expect(config.providers).toContain('gemini');
      expect(config.roles).toBeDefined();
      expect(config.roles?.claude).toBe('proponent');
      expect(config.roles?.grok).toBe('opponent');
      expect(config.roles?.gemini).toBe('judge');
    });

    it('should accept custom roles', () => {
      const config = createDebateConfig('Topic', 'grok', 'gemini', 'claude');
      expect(config.providers).toEqual(['grok', 'gemini', 'claude']);
      expect(config.roles?.grok).toBe('proponent');
      expect(config.roles?.gemini).toBe('opponent');
      expect(config.roles?.claude).toBe('judge');
    });
  });

  describe('createVotingConfig', () => {
    it('should create valid voting config', () => {
      const config = createVotingConfig('Choose the best', ['A', 'B', 'C']);
      expect(config.pattern).toBe('voting');
      expect(config.prompt).toContain('A, B, C');
      expect(config.rounds).toBe(1);
      expect(config.consensus.method).toBe('voting');
    });

    it('should accept custom providers', () => {
      const config = createVotingConfig('Vote', ['X', 'Y'], ['claude', 'grok']);
      expect(config.providers).toEqual(['claude', 'grok']);
    });
  });

  describe('createEmptyDiscussionResult', () => {
    it('should create valid empty result', () => {
      const result = createEmptyDiscussionResult('synthesis', 'Test topic');
      expect(result.success).toBe(true);
      expect(result.pattern).toBe('synthesis');
      expect(result.topic).toBe('Test topic');
      expect(result.participatingProviders).toEqual([]);
      expect(result.rounds).toEqual([]);
      expect(result.synthesis).toBe('');

      // Validate the result
      const validation = DiscussionResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('createFailedDiscussionResult', () => {
    it('should create valid failed result', () => {
      const startedAt = new Date().toISOString();
      const result = createFailedDiscussionResult(
        'synthesis',
        'Failed topic',
        DiscussionErrorCodes.ALL_PROVIDERS_FAILED,
        'All providers timed out',
        startedAt
      );

      expect(result.success).toBe(false);
      expect(result.pattern).toBe('synthesis');
      expect(result.topic).toBe('Failed topic');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('DISCUSSION_ALL_PROVIDERS_FAILED');
      expect(result.error?.message).toBe('All providers timed out');

      // Validate the result
      const validation = DiscussionResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Discussion Contract - Constants', () => {
  it('should have correct constant values', () => {
    expect(MIN_PROVIDERS).toBe(2);
    expect(MAX_PROVIDERS).toBe(6);
    expect(MAX_ROUNDS).toBe(10);
    expect(DEFAULT_ROUNDS).toBe(2);
  });

  it('should have correct default providers', () => {
    expect(DEFAULT_PROVIDERS).toContain('claude');
    expect(DEFAULT_PROVIDERS).toContain('grok');
    expect(DEFAULT_PROVIDERS).toContain('gemini');
    expect(DEFAULT_PROVIDERS).toContain('codex');
    expect(DEFAULT_PROVIDERS.length).toBe(4);
  });
});
